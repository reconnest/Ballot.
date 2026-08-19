import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options } from "@/db/schema";
import { nanoid, customAlphabet } from "nanoid";
import { randomBytes, createHash } from "crypto";

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body.question ?? "").toString().trim().slice(0, 140);
    const description = body.description ? body.description.toString().trim().slice(0, 1000) : null;
    const rawOptions: string[] = Array.isArray(body.options) ? body.options : [];
    const cleanOptions = rawOptions
      .map((o) => (o ?? "").toString().trim().slice(0, 100))
      .filter((o) => o.length > 0)
      .slice(0, 30);
    const expiresInMs: number | null = typeof body.expiresInMs === "number" ? body.expiresInMs : null;
    const requireName: boolean = !!body.requireName;
    const allowMultiple: boolean = !!body.allowMultiple;
    const minChoices = allowMultiple && typeof body.minChoices === "number" && body.minChoices >= 1 ? Math.min(body.minChoices, cleanOptions.length) : 1;
    const maxChoices = allowMultiple && typeof body.maxChoices === "number" && body.maxChoices >= minChoices ? Math.min(body.maxChoices, cleanOptions.length) : null;
    
    const validVisibilities = ["always_public", "after_vote", "after_deadline", "creator_only"];
    const resultsVisibility = validVisibilities.includes(body.resultsVisibility) ? body.resultsVisibility : "always_public";

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }
    if (cleanOptions.length < 2) {
      return NextResponse.json({ error: "Add at least two options." }, { status: 400 });
    }

    const now = Date.now();
    const pollId = nanoid();
    const slug = slugId();

    // Generate secure admin key and its hash
    const adminKey = randomBytes(24).toString("hex");
    const adminKeyHash = createHash("sha256").update(adminKey).digest("hex");

    await db.insert(polls).values({
      id: pollId,
      slug,
      question,
      description,
      allowMultiple: allowMultiple ? 1 : 0,
      minChoices,
      maxChoices,
      resultsVisibility,
      requireName: requireName ? 1 : 0,
      adminKeyHash,
      createdAt: now,
      expiresAt: expiresInMs ? now + expiresInMs : null,
    });

    await db.insert(options).values(
      cleanOptions.map((label, i) => ({
        id: nanoid(),
        pollId,
        label,
        position: i,
      }))
    );

    return NextResponse.json({ slug, adminKey });
  } catch (e) {
    console.error("create poll failed", e);
    return NextResponse.json({ error: "Could not create poll." }, { status: 500 });
  }
}

