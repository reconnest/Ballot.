import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq, and, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { resolveVoterToken, attachVoterCookie } from "@/lib/voter-token";
import { getClientIp, hashIp, verifyTurnstileToken, checkPollAnomalyVelocity } from "@/lib/security";
import { broadcastVoteUpdate } from "@/lib/realtime";
import { captureException } from "@/lib/error-monitor";


export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const voterName = body.voterName ? body.voterName.toString().trim().slice(0, 60) : null;
    const idempotencyKey = body.idempotencyKey ? body.idempotencyKey.toString().slice(0, 64) : null;
    const turnstileToken = body.turnstileToken ? body.turnstileToken.toString() : null;

    // Support single optionId or array optionIds
    let selectedOptionIds: string[] = [];
    if (Array.isArray(body.optionIds)) {
      selectedOptionIds = Array.from(new Set(body.optionIds.map((id: unknown) => (id ?? "").toString().trim()).filter(Boolean)));
    } else if (body.optionId) {
      selectedOptionIds = [body.optionId.toString().trim()];
    }

    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll || poll.status === "deleted") {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;
    if (poll.status === "inactive" || isExpired) {
      return NextResponse.json({ error: "This poll is inactive and no longer accepting votes." }, { status: 403 });
    }

    if (poll.requireName && !voterName) {
      return NextResponse.json({ error: "This poll requires your name." }, { status: 400 });
    }
    if (selectedOptionIds.length === 0) {
      return NextResponse.json({ error: "Please select at least one option." }, { status: 400 });
    }

    // Resolve client IP & salted hash
    const clientIp = getClientIp(req);
    const ipSalt = poll.ipSalt || "ballot_default_salt";
    const ipHash = hashIp(clientIp, ipSalt);

    // Turnstile bot verification check (if strict mode or abnormal burst detected)
    const isBurstDetected = checkPollAnomalyVelocity(poll.id);
    const requiresBotCheck = poll.securityMode === "strict" || isBurstDetected;

    if (requiresBotCheck) {
      const isBotValid = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!isBotValid) {
        return NextResponse.json(
          {
            error: "Bot verification required. Please complete the security challenge.",
            requiresTurnstile: true,
          },
          { status: 403 }
        );
      }
    }

    // Validate single vs multi selection constraints (ranked choice allows ordering all options)
    if (poll.pollType !== "ranked_choice" && !poll.allowMultiple && selectedOptionIds.length > 1) {
      return NextResponse.json({ error: "This poll only allows selecting one option." }, { status: 400 });
    }

    if (poll.allowMultiple) {
      if (selectedOptionIds.length < poll.minChoices) {
        return NextResponse.json(
          { error: `Please select at least ${poll.minChoices} option${poll.minChoices === 1 ? "" : "s"}.` },
          { status: 400 }
        );
      }
      if (poll.maxChoices && selectedOptionIds.length > poll.maxChoices) {
        return NextResponse.json(
          { error: `You can select at most ${poll.maxChoices} option${poll.maxChoices === 1 ? "" : "s"}.` },
          { status: 400 }
        );
      }
    }

    // Verify selected options belong to this poll
    const validOptions = await db
      .select({ id: options.id })
      .from(options)
      .where(and(eq(options.pollId, poll.id), inArray(options.id, selectedOptionIds)));

    if (validOptions.length !== selectedOptionIds.length) {
      return NextResponse.json({ error: "One or more selected options are invalid." }, { status: 400 });
    }

    const { token: voterToken, isNew } = resolveVoterToken(req);

    const isUnlimited = poll.securityMode === "unlimited" || poll.securityMode === "none";
    const effectiveVoterToken = isUnlimited ? nanoid() : voterToken;

    let existingVote = null;
    if (!isUnlimited) {
      // Duplicate prevention based on securityMode:
      // 'relaxed': checks voterToken only
      // 'standard' / 'strict': checks voterToken OR ipHash
      const checkDuplicateCondition =
        poll.securityMode === "relaxed"
          ? and(eq(votes.pollId, poll.id), eq(votes.voterToken, effectiveVoterToken))
          : and(
              eq(votes.pollId, poll.id),
              or(eq(votes.voterToken, effectiveVoterToken), eq(votes.ipHash, ipHash))
            );

      const [foundVote] = await db
        .select({ id: votes.id, voterToken: votes.voterToken, voterName: votes.voterName, ipHash: votes.ipHash, ballotId: votes.ballotId })
        .from(votes)
        .where(checkDuplicateCondition)
        .limit(1);

      existingVote = foundVote;

      const isIpMatch = existingVote && existingVote.ipHash === ipHash && existingVote.voterToken !== effectiveVoterToken;

      if (isIpMatch) {
        const res = NextResponse.json(
          { error: "A vote was already recorded from this network / IP address." },
          { status: 409 }
        );
        if (isNew) attachVoterCookie(res, voterToken);
        return res;
      }
    }


    const now = Date.now();
    let isVoteEdit = false;
    let finalVoterName = voterName;
    let ballotId = nanoid();

    // ── Fix 1.4: Enforce idempotency — prevent double-submit on slow mobile ──
    if (idempotencyKey && !isUnlimited) {
      const [alreadySubmitted] = await db
        .select({ id: votes.id })
        .from(votes)
        .where(and(eq(votes.pollId, poll.id), eq(votes.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (alreadySubmitted) {
        const res = NextResponse.json({ ok: true, ballotId, isEdit: false, deduplicated: true });
        if (isNew) attachVoterCookie(res, voterToken);
        return res;
      }
    }

    if (existingVote) {
      if (poll.allowVoteEdit === 0) {
        const res = NextResponse.json(
          { error: "You have already voted on this poll." },
          { status: 409 }
        );
        if (isNew) attachVoterCookie(res, voterToken);
        return res;
      }

      // Vote Editing Mode: Preserve original locked name and replace ballot
      isVoteEdit = true;
      ballotId = existingVote.ballotId || ballotId;
      finalVoterName = existingVote.voterName || voterName; // Name locked once submitted
    }

    // Build new vote rows
    const voteRows = selectedOptionIds.map((optId, index) => ({
      id: nanoid(),
      pollId: poll.id,
      optionId: optId,
      voterToken: effectiveVoterToken,
      voterName: finalVoterName,
      ipHash,
      ballotId,
      rankPosition: poll.pollType === "ranked_choice" ? index + 1 : null,
      idempotencyKey,
      createdAt: now,
    }));

    // ── DB insert with unique constraint handling for concurrent requests ──
    try {
      if (isVoteEdit) {
        await db.transaction(async (tx) => {
          await tx
            .delete(votes)
            .where(and(eq(votes.pollId, poll.id), eq(votes.voterToken, effectiveVoterToken)));
          await tx.insert(votes).values(voteRows);
        });
      } else {
        await db.insert(votes).values(voteRows);
      }
    } catch (insertErr: any) {
      const errMsg = insertErr?.message || String(insertErr);
      const isConstraintViolation =
        errMsg.includes("UNIQUE constraint failed") ||
        errMsg.includes("SQLITE_CONSTRAINT") ||
        errMsg.includes("constraint");

      if (isConstraintViolation && !isUnlimited) {
        // Handle race condition: a concurrent vote with same voter token already completed
        if (poll.allowVoteEdit === 0) {
          const res = NextResponse.json(
            { error: "You have already voted on this poll." },
            { status: 409 }
          );
          if (isNew) attachVoterCookie(res, voterToken);
          return res;
        }

        // If vote editing is allowed, execute edit via transaction
        isVoteEdit = true;
        await db.transaction(async (tx) => {
          await tx
            .delete(votes)
            .where(and(eq(votes.pollId, poll.id), eq(votes.voterToken, effectiveVoterToken)));
          await tx.insert(votes).values(voteRows);
        });
      } else {
        throw insertErr;
      }
    }

    // Trigger debounced realtime broadcast to all active spectators
    try {
      broadcastVoteUpdate(params.slug, {
        pollId: poll.id,
        timestamp: now,
      });
    } catch {}

    const res = NextResponse.json({ ok: true, ballotId, isEdit: isVoteEdit });
    if (isNew) attachVoterCookie(res, voterToken);
    return res;



  } catch (e) {
    captureException(e, { route: "POST /api/polls/[slug]/vote", pollSlug: params.slug });
    return NextResponse.json({ error: "Could not record vote. Please try again." }, { status: 500 });
  }

}



