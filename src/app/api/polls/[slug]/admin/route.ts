import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid, customAlphabet } from "nanoid";
import { randomBytes, createHash } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { generateIpSalt } from "@/lib/security";

const scopedCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

function verifyAdmin(key: string | null, hash: string | null, sessionUserId?: string, pollCreatorId?: string | null): boolean {
  if (sessionUserId && pollCreatorId && sessionUserId === pollCreatorId) return true;
  if (!key || !hash) return false;
  const computed = createHash("sha256").update(key.trim()).digest("hex");
  return computed === hash;
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll || poll.status === "deleted") {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const sessionUser = await getSessionUser(req);
    const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-admin-key");
    if (!verifyAdmin(key, poll.adminKeyHash, sessionUser?.id, poll.creatorUserId)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key or session." }, { status: 401 });
    }

    const pollOptions = await db
      .select()
      .from(options)
      .where(eq(options.pollId, poll.id))
      .orderBy(options.position);

    const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));

    const counts: Record<string, number> = {};
    for (const o of pollOptions) counts[o.id] = 0;
    for (const v of pollVotes) counts[v.optionId] = (counts[v.optionId] ?? 0) + 1;

    const uniqueBallots = new Set(pollVotes.map((v) => v.voterToken)).size;

    return NextResponse.json({
      poll,
      options: pollOptions.map((o) => ({ ...o, votes: counts[o.id] ?? 0 })),
      totalBallots: uniqueBallots,
      totalSelections: pollVotes.length,
      votes: pollVotes.map((v) => ({
        id: v.id,
        optionId: v.optionId,
        voterName: v.voterName,
        createdAt: v.createdAt,
      })),
    });
  } catch (e) {
    console.error("admin get failed", e);
    return NextResponse.json({ error: "Could not fetch admin data." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll || poll.status === "deleted") {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const sessionUser = await getSessionUser(req);
    const body = await req.json();
    const key = (body.adminKey ?? req.headers.get("x-admin-key") ?? "").toString();
    if (!verifyAdmin(key, poll.adminKeyHash, sessionUser?.id, poll.creatorUserId)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key or session." }, { status: 401 });
    }

    // 1. REPOLL ACTION: Creates linked Round 2 and sets current poll to inactive
    if (body.action === "repoll") {
      const prefix = poll.isPublic === 1 ? "BPC" : "BPP";
      const newSlug = `${prefix}-${scopedCode()}`;
      const newPollId = nanoid();
      const now = Date.now();
      const adminKey = randomBytes(24).toString("hex");
      const adminKeyHash = createHash("sha256").update(adminKey).digest("hex");
      const ipSalt = generateIpSalt();

      // Fetch existing options
      const existingOptions = await db
        .select()
        .from(options)
        .where(eq(options.pollId, poll.id))
        .orderBy(options.position);

      // Create new Round
      await db.insert(polls).values({
        id: newPollId,
        slug: newSlug,
        question: poll.question,
        description: poll.description,
        pollType: poll.pollType,
        category: poll.category,
        isPublic: poll.isPublic,
        allowMultiple: poll.allowMultiple,
        minChoices: poll.minChoices,
        maxChoices: poll.maxChoices,
        resultsVisibility: poll.resultsVisibility,
        requireName: poll.requireName,
        securityMode: poll.securityMode,
        status: "live",
        allowVoteEdit: poll.allowVoteEdit,
        repolledFrom: poll.slug, // Link back to original round
        ipSalt,
        adminKeyHash,
        creatorUserId: poll.creatorUserId,
        createdAt: now,
        expiresAt: null,
      });

      await db.insert(options).values(
        existingOptions.map((opt, idx) => ({
          id: nanoid(),
          pollId: newPollId,
          label: opt.label,
          imageUrl: opt.imageUrl,
          position: idx,
        }))
      );

      // Mark original poll as inactive
      await db.update(polls).set({ status: "inactive" }).where(eq(polls.id, poll.id));

      return NextResponse.json({
        ok: true,
        repolled: true,
        newSlug,
        adminKey,
        message: `Repoll created as ${newSlug}`,
      });
    }

    // 2. TOGGLE STATUS (Live <-> Inactive)
    if (body.action === "toggle_status") {
      const newStatus = poll.status === "live" ? "inactive" : "live";
      await db.update(polls).set({ status: newStatus }).where(eq(polls.id, poll.id));
      return NextResponse.json({ ok: true, status: newStatus });
    }

    // 3. SETTINGS UPDATES
    const updateFields: Partial<{
      description: string | null;
      expiresAt: number | null;
      resultsVisibility: string;
      allowVoteEdit: number;
      category: string;
      status: string;
    }> = {};

    if (body.description !== undefined) {
      updateFields.description = body.description ? body.description.toString().trim() : null;
    }
    if (body.action === "close_now") {
      updateFields.status = "inactive";
      updateFields.expiresAt = Date.now();
    } else if (typeof body.expiresAt === "number" || body.expiresAt === null) {
      updateFields.expiresAt = body.expiresAt;
    }
    if (typeof body.resultsVisibility === "string") {
      const valid = ["always_public", "after_vote", "after_deadline", "creator_only"];
      if (valid.includes(body.resultsVisibility)) {
        updateFields.resultsVisibility = body.resultsVisibility;
      }
    }
    if (body.allowVoteEdit !== undefined) {
      updateFields.allowVoteEdit = body.allowVoteEdit ? 1 : 0;
    }
    if (typeof body.category === "string" && body.category.trim()) {
      updateFields.category = body.category.trim().slice(0, 30);
    }

    if (Object.keys(updateFields).length > 0) {
      await db.update(polls).set(updateFields).where(eq(polls.id, poll.id));
    }

    return NextResponse.json({ ok: true, updated: updateFields });
  } catch (e) {
    console.error("admin patch failed", e);
    return NextResponse.json({ error: "Could not update poll." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const sessionUser = await getSessionUser(req);
    const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-admin-key");
    if (!verifyAdmin(key, poll.adminKeyHash, sessionUser?.id, poll.creatorUserId)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key or session." }, { status: 401 });
    }

    // Mark as deleted for clean 404 handling
    await db.update(polls).set({ status: "deleted" }).where(eq(polls.id, poll.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin delete failed", e);
    return NextResponse.json({ error: "Could not delete poll." }, { status: 500 });
  }
}

