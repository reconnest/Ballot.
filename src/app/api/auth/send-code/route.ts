import { NextRequest, NextResponse } from "next/server";
import { db, ensureDbSchema } from "@/db";
import { authCodes } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashOtpCode, generate6DigitCode } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();
    const body = await req.json();
    const email = (body.email ?? "").toString().trim().toLowerCase();

    if (!email || !email.includes("@") || email.length < 5) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const now = Date.now();

    // 60-second cooldown check to prevent inbox bombing
    const [recentCode] = await db
      .select()
      .from(authCodes)
      .where(and(eq(authCodes.email, email), gt(authCodes.createdAt, now - 60 * 1000)))
      .orderBy(desc(authCodes.createdAt))
      .limit(1);

    if (recentCode) {
      const waitSeconds = Math.ceil((recentCode.createdAt + 60 * 1000 - now) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before requesting a new code.` },
        { status: 429 }
      );
    }

    const code = generate6DigitCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    await db.insert(authCodes).values({
      id: nanoid(),
      email,
      codeHash,
      attempts: 0,
      createdAt: now,
      expiresAt,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Ballot Auth] (Dev only) Verification Code for ${email}: ${code}`);
    }


    // Dispatch email to user's inbox
    const mailResult = await sendOtpEmail(email, code);
    if (!mailResult.success) {
      console.warn("Could not dispatch via Resend:", mailResult.error);
      return NextResponse.json({
        error: mailResult.error || "Could not send verification email."
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Verification code sent to your email.",
    });

  } catch (err) {
    console.error("send-code error:", err);
    return NextResponse.json({ error: "Could not send verification code." }, { status: 500 });
  }
}


