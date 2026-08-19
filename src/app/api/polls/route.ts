import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options } from "@/db/schema";
import { nanoid, customAlphabet } from "nanoid";
import { randomBytes, createHash } from "crypto";
import { getClientIp, generateIpSalt, checkPollCreationRateLimit } from "@/lib/security";

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkPollCreationRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many polls created. Please wait ${rateCheck.retryAfterSeconds}s before creating another.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const question = (body.question ?? "").toString().trim().slice(0, 140);
    const description = body.description ? body.description.toString().trim().slice(0, 1000) : null;
    const pollType = ["standard", "ranked_choice", "image", "availability"].includes(body.pollType) ? body.pollType : "standard";
    const category = (body.category ?? "general").toString().trim().slice(0, 30);
    const isPublic = body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1;

    // Support both string[] and { label: string, imageUrl?: string }[]
    const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : [];
    const cleanOptions = rawOptions
      .map((o: any) => {
        if (typeof o === "object" && o !== null) {
          return {
            label: (o.label ?? "").toString().trim().slice(0, 100),
            imageUrl: o.imageUrl ? o.imageUrl.toString().trim().slice(0, 500) : null,
          };
        }
        return {
          label: (o ?? "").toString().trim().slice(0, 100),
          imageUrl: null,
        };
      })
      .filter((o) => o.label.length > 0)
      .slice(0, 30);


    const expiresInMs: number | null = typeof body.expiresInMs === "number" ? body.expiresInMs : null;
    const requireName: boolean = !!body.requireName;
    const allowMultiple: boolean = !!body.allowMultiple;
    const minChoices = allowMultiple && typeof body.minChoices === "number" && body.minChoices >= 1 ? Math.min(body.minChoices, cleanOptions.length) : 1;
    const maxChoices = allowMultiple && typeof body.maxChoices === "number" && body.maxChoices >= minChoices ? Math.min(body.maxChoices, cleanOptions.length) : null;
    
    const validVisibilities = ["always_public", "after_vote", "after_deadline", "creator_only"];
    const resultsVisibility = validVisibilities.includes(body.resultsVisibility) ? body.resultsVisibility : "always_public";

    const validSecurity = ["relaxed", "standard", "strict"];
    const securityMode = validSecurity.includes(body.securityMode) ? body.securityMode : "standard";

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }
    if (cleanOptions.length < 2) {
      return NextResponse.json({ error: "Add at least two options." }, { status: 400 });
    }

    const now = Date.now();
    const pollId = nanoid();
    const slug = slugId();

    // Generate secure admin key and per-poll IP salt
    const adminKey = randomBytes(24).toString("hex");
    const adminKeyHash = createHash("sha256").update(adminKey).digest("hex");
    const ipSalt = generateIpSalt();

    await db.insert(polls).values({
      id: pollId,
      slug,
      question,
      description,
      pollType,
      category,
      isPublic,
      allowMultiple: allowMultiple ? 1 : 0,
      minChoices,
      maxChoices,
      resultsVisibility,
      requireName: requireName ? 1 : 0,
      securityMode,
      ipSalt,
      adminKeyHash,
      createdAt: now,
      expiresAt: expiresInMs ? now + expiresInMs : null,
    });

    await db.insert(options).values(
      cleanOptions.map((opt, i) => ({
        id: nanoid(),
        pollId,
        label: opt.label,
        imageUrl: opt.imageUrl,
        position: i,
      }))
    );


    return NextResponse.json({ slug, adminKey });
  } catch (e) {
    console.error("create poll failed", e);
    return NextResponse.json({ error: "Could not create poll." }, { status: 500 });
  }
}


