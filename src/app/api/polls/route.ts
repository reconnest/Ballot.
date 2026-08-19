import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options } from "@/db/schema";
import { nanoid, customAlphabet } from "nanoid";

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body.question ?? "").toString().trim().slice(0, 140);
    const rawOptions: string[] = Array.isArray(body.options) ? body.options : [];
    const cleanOptions = rawOptions
      .map((o) => (o ?? "").toString().trim().slice(0, 80))
      .filter((o) => o.length > 0)
      .slice(0, 10);
    const expiresInMs: number | null = typeof body.expiresInMs === "number" ? body.expiresInMs : null;

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }
    if (cleanOptions.length < 2) {
      return NextResponse.json({ error: "Add at least two options." }, { status: 400 });
    }

    const now = Date.now();
    const pollId = nanoid();
    const slug = slugId();

    await db.insert(polls).values({
      id: pollId,
      slug,
      question,
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

    return NextResponse.json({ slug });
  } catch (e) {
    console.error("create poll failed", e);
    return NextResponse.json({ error: "Could not create poll." }, { status: 500 });
  }
}
