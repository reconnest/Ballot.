import { NextRequest, NextResponse } from "next/server";
import { db, ensureDbSchema } from "@/db";
import { users, authCodes } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashOtpCode, validateHandle, createSession, attachSessionCookie } from "@/lib/auth";
import { captureException } from "@/lib/error-monitor";


export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();
    const body = await req.json();

    const email = (body.email ?? "").toString().trim().toLowerCase();
    const code = (body.code ?? "").toString().trim();
    const desiredUsername = body.username ? body.username.toString().trim().toLowerCase() : null;
    const displayName = body.displayName ? body.displayName.toString().trim() : null;

    if (!email || !code) {
      return NextResponse.json({ error: "Email and verification code are required." }, { status: 400 });
    }

    const now = Date.now();

    // Find active OTP code
    const [authRecord] = await db
      .select()
      .from(authCodes)
      .where(and(eq(authCodes.email, email), gt(authCodes.expiresAt, now)))
      .orderBy(desc(authCodes.createdAt))
      .limit(1);

    if (!authRecord) {
      return NextResponse.json({ error: "Code expired or not found. Please request a new one." }, { status: 400 });
    }

    if (authRecord.attempts >= 5) {
      // Destroy code on max attempts lockout
      await db.delete(authCodes).where(eq(authCodes.id, authRecord.id));
      return NextResponse.json({ error: "Too many failed attempts. Code locked out. Request a new one." }, { status: 403 });
    }

    const submittedHash = hashOtpCode(code);
    if (submittedHash !== authRecord.codeHash) {
      // Increment attempt counter
      await db
        .update(authCodes)
        .set({ attempts: authRecord.attempts + 1 })
        .where(eq(authCodes.id, authRecord.id));

      const remaining = 5 - (authRecord.attempts + 1);
      return NextResponse.json(
        { error: `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
        { status: 400 }
      );
    }

    // Check if user already exists
    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      // New User Registration Flow: requires handle selection
      if (!desiredUsername) {
        // Return needsRegistration without deleting authCode yet, so step 2 can complete registration
        return NextResponse.json({
          needsRegistration: true,
          email,
          message: "Code verified! Please choose your unique @handle.",
        });
      }

      const handleCheck = validateHandle(desiredUsername);
      if (!handleCheck.valid) {
        return NextResponse.json({ error: handleCheck.error }, { status: 400 });
      }

      // Check handle uniqueness
      const [handleTaken] = await db
        .select()
        .from(users)
        .where(eq(users.username, desiredUsername))
        .limit(1);

      if (handleTaken) {
        return NextResponse.json({ error: `@${desiredUsername} is already taken. Please choose another.` }, { status: 409 });
      }

      const newUserId = nanoid();
      await db.insert(users).values({
        id: newUserId,
        email,
        username: desiredUsername,
        displayName: displayName || desiredUsername,
        createdAt: now,
      });

      const [created] = await db.select().from(users).where(eq(users.id, newUserId)).limit(1);
      existingUser = created;
    }

    // Code is fully consumed! Invalidate code now that user is registered/logged in
    await db.delete(authCodes).where(eq(authCodes.id, authRecord.id));

    // Create session token
    const sessionToken = await createSession(existingUser.id);
    const res = NextResponse.json({

      ok: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        displayName: existingUser.displayName,
        avatarUrl: existingUser.avatarUrl,
      },
    });

    attachSessionCookie(res, sessionToken);
    return res;
  } catch (err) {
    captureException(err, { route: "POST /api/auth/verify-code" });
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }

}
