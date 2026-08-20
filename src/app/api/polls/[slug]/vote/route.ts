import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq, and, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { resolveVoterToken, attachVoterCookie } from "@/lib/voter-token";
import { getClientIp, hashIp, verifyTurnstileToken, checkPollAnomalyVelocity } from "@/lib/security";
import { broadcastVoteUpdate } from "@/lib/realtime";

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

    // Duplicate prevention based on securityMode:
    // 'relaxed': checks voterToken only
    // 'standard' / 'strict': checks voterToken OR ipHash
    const checkDuplicateCondition =
      poll.securityMode === "relaxed"
        ? and(eq(votes.pollId, poll.id), eq(votes.voterToken, voterToken))
        : and(
            eq(votes.pollId, poll.id),
            or(eq(votes.voterToken, voterToken), eq(votes.ipHash, ipHash))
          );

    const [existingVote] = await db
      .select({ id: votes.id, voterToken: votes.voterToken, voterName: votes.voterName, ipHash: votes.ipHash, ballotId: votes.ballotId })
      .from(votes)
      .where(checkDuplicateCondition)
      .limit(1);

    const isIpMatch = existingVote && existingVote.ipHash === ipHash && existingVote.voterToken !== voterToken;

    if (isIpMatch) {
      const res = NextResponse.json(
        { error: "A vote was already recorded from this network / IP address." },
        { status: 409 }
      );
      if (isNew) attachVoterCookie(res, voterToken);
      return res;
    }

    const now = Date.now();
    let isVoteEdit = false;
    let finalVoterName = voterName;
    let ballotId = nanoid();

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

      // Atomically delete old choices for this voter
      await db
        .delete(votes)
        .where(and(eq(votes.pollId, poll.id), eq(votes.voterToken, voterToken)));
    }

    // Insert new choices under the ballot transaction with rank position
    const voteRows = selectedOptionIds.map((optId, index) => ({
      id: nanoid(),
      pollId: poll.id,
      optionId: optId,
      voterToken,
      voterName: finalVoterName,
      ipHash,
      ballotId,
      rankPosition: poll.pollType === "ranked_choice" ? index + 1 : null,
      idempotencyKey,
      createdAt: now,
    }));

    await db.insert(votes).values(voteRows);

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
    console.error("vote failed", e);
    return NextResponse.json({ error: "Could not record vote. Please try again." }, { status: 500 });
  }
}



