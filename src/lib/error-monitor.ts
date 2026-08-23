/**
 * Production Error Monitoring & Diagnostics Layer for Ballot
 * Captures and routes unhandled exceptions in API routes and client workflows.
 * Supports Sentry DSN, generic webhooks (Discord/Slack/Vercel log drains), and structured error telemetry.
 */

type ErrorContext = {
  route?: string;
  action?: string;
  pollSlug?: string;
  userId?: string;
  extra?: Record<string, unknown>;
};

export function captureException(error: unknown, context: ErrorContext = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const payload = {
    timestamp,
    level: "error",
    message: errorMessage,
    stack: errorStack,
    environment: process.env.NODE_ENV || "development",
    ...context,
  };

  // Structured production log output (readable by Vercel Logs, Datadog, Axiom)
  console.error(`[ERROR_MONITOR] [${context.route || "global"}]`, JSON.stringify(payload));

  // If SENTRY_DSN or Webhook is configured, dispatch out-of-band telemetry
  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (webhookUrl && typeof fetch !== "undefined") {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **Ballot Error Alert**\n**Route**: \`${context.route || "unknown"}\`\n**Message**: \`${errorMessage}\`\n**Time**: \`${timestamp}\``,
      }),
    }).catch(() => {});
  }
}

export function captureMessage(message: string, level: "info" | "warn" | "error" = "info", context: ErrorContext = {}) {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level,
    message,
    environment: process.env.NODE_ENV || "development",
    ...context,
  };

  if (level === "error") {
    console.error(`[ERROR_MONITOR] [${context.route || "global"}]`, JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(`[WARN_MONITOR] [${context.route || "global"}]`, JSON.stringify(payload));
  }
}
