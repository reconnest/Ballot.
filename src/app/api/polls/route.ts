import { NextRequest, NextResponse } from "next/server";
import { db, ensureDbSchema } from "@/db";
import { polls, options } from "@/db/schema";
import { nanoid, customAlphabet } from "nanoid";
import { randomBytes, createHash } from "crypto";
import { getClientIp, generateIpSalt, checkPollCreationRateLimit } from "@/lib/security";
import { getSessionUser } from "@/lib/auth";

const scopedCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();

    const clientIp = getClientIp(req);
    const rateCheck = await checkPollCreationRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many polls created. Please wait ${rateCheck.retryAfterSeconds}s before creating another.` },
        { status: 429 }
      );
    }

    // ── Fix 1.3: Guard against Versal's 4.5 MB serverless payload limit ──
    const contentLength = parseInt(req.headers.get("content-length") || "0");

    if (contentLength > 4_000_000) {
      return NextResponse.json(
        { error: "Total upload size is too large (max ~4 MB). Please reduce the number or size of images." },
        { status: 413 }
      );
    }

    const sessionUser = await getSessionUser(req);
    const body = await req.json();
    const isPublic = body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1;


    // Strict Policy: Public Community Polls (BPC) REQUIRE a logged-in creator account
    if (isPublic === 1 && !sessionUser) {
      return NextResponse.json(
        {
          error: "A creator account is required to publish public community polls. Please log in or sign up.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    const question = (body.question ?? "").toString().trim().slice(0, 140);
    const description = body.description ? body.description.toString().trim().slice(0, 1000) : null;
    const pollType = ["standard", "ranked_choice", "image", "availability"].includes(body.pollType) ? body.pollType : "standard";
    const category = (body.category ?? "general").toString().trim().slice(0, 30);

    // Generate Scoped ID Prefix: BPC-xxxx (Community) vs BPP-xxxx (Private)
    const prefix = isPublic === 1 ? "BPC" : "BPP";
    const slug = `${prefix}-${scopedCode()}`;

    // Support both string[] and { label: string, imageUrl?: string }[]
    const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : [];
    const cleanOptions = rawOptions
      .map((o: any) => {
        if (typeof o === "object" && o !== null) {
          return {
            label: (o.label ?? "").toString().trim().slice(0, 100),
            imageUrl: o.imageUrl && typeof o.imageUrl === "string" && o.imageUrl.trim().length > 0 ? o.imageUrl.trim() : null,
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

    const validSecurity = ["unlimited", "relaxed", "standard", "strict"];
    const securityMode = validSecurity.includes(body.securityMode) ? body.securityMode : "relaxed";

    const allowVoteEdit = body.allowVoteEdit !== undefined ? (body.allowVoteEdit ? 1 : 0) : 1;
    // ── Fix 1.2: Enforce 80-char max on creatorName at API layer ──
    const creatorName = !sessionUser && body.creatorName ? body.creatorName.toString().trim().slice(0, 80) : null;

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }
    if (cleanOptions.length < 2) {
      return NextResponse.json({ error: "Add at least two options." }, { status: 400 });
    }

    const now = Date.now();
    const pollId = nanoid();

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
      status: "live",
      allowVoteEdit,
      repolledFrom: null,
      ipSalt,
      adminKeyHash,
      creatorUserId: sessionUser ? sessionUser.id : null,
      creatorName,
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

    return NextResponse.json({ slug, adminKey, isPublic: isPublic === 1 });
  } catch (e) {
    console.error("create poll failed", e);
    return NextResponse.json({ error: "Could not create poll." }, { status: 500 });
  }
}



