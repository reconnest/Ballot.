import nodemailer from "nodemailer";

/**
 * Universal email delivery utility for Ballot Authentication.
 * Supports:
 * 1. Gmail SMTP (No custom domain required! Uses SMTP_USER and SMTP_PASS).
 * 2. Custom SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 * 3. Resend API (RESEND_API_KEY).
 */
export async function sendOtpEmail(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 30px 15px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 460px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 36px; margin-bottom: 8px;">🗳️</div>
          <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.02em;">Ballot Creator Access</h1>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">One-Time Verification Code</p>
        </div>

        <!-- OTP Code Box -->
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f766e; display: inline-block;">
            ${code}
          </span>
        </div>

        <!-- Body Text -->
        <p style="font-size: 14px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
          Use this 6-digit code to sign in or register your creator handle on Ballot.
        </p>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #92400e; margin-bottom: 24px;">
          ⏱️ This code will expire in <strong>10 minutes</strong>.
        </div>

        <!-- Footer -->
        <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin: 0; text-align: center;">
          If you did not request this email, you can safely ignore it.
        </p>
      </div>
    </body>
    </html>
  `;

  // 1. Gmail SMTP or Custom SMTP (100% Free, NO Custom Domain Needed!)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: !process.env.SMTP_HOST ? "gmail" : undefined,
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Ballot" <${smtpUser}>`,
        to,
        subject: `${code} is your Ballot verification code`,
        html: htmlContent,
      });

      return { success: true };
    } catch (err: any) {
      console.error("SMTP sending error:", err);
      return { success: false, error: err?.message || "Failed to send email via SMTP." };
    }
  }

  // 2. Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || "Ballot <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: `${code} is your Ballot verification code`,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Resend API error:", data);
        return { success: false, error: data.message || "Failed to send email via Resend." };
      }

      return { success: true };
    } catch (err: any) {
      console.error("Resend send error:", err);
      return { success: false, error: err?.message || "Failed to send email via Resend." };
    }
  }

  // Fallback
  console.log(`[Ballot Auth] No email provider configured. Verification code for ${to}: ${code}`);
  return {
    success: false,
    error: "Email provider not configured. Add Gmail SMTP_USER & SMTP_PASS in Vercel to send emails with no domain needed."
  };
}

