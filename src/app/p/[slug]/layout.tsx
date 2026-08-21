import type { Metadata } from "next";
import { db } from "@/db";
import { polls, options } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);

    if (!poll) {
      return {
        title: "Poll Not Found — Ballot",
        description: "This poll may have been deleted or does not exist.",
      };
    }

    // Fetch option count for the description
    const pollOptions = await db
      .select({ id: options.id })
      .from(options)
      .where(eq(options.pollId, poll.id));
    const optionCount = pollOptions.length;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ballot-poll.vercel.app";
    const pollUrl = `${baseUrl}/p/${params.slug}`;
    const ogImageUrl = `${baseUrl}/api/og/${params.slug}`;

    // ── Fix 3.1: Clean, punchy title that shows the actual poll question ──
    const title = `${poll.question} — Vote on Ballot`;
    const description = poll.description
      ? `${poll.description.slice(0, 130)} · ${optionCount} options · Live results · No signup`
      : `${optionCount} options · Live results · 100% free, no signup required.`;

    // ── Fix 3.2: noindex for private BPP- polls, canonical URL for all polls ──
    const isPrivate = params.slug.startsWith("BPP-");

    return {
      title,
      description,
      // Canonical URL prevents duplicate content when ?key= is in the URL
      alternates: {
        canonical: pollUrl,
      },
      // Private polls must not be indexed by search engines
      robots: isPrivate
        ? { index: false, follow: false }
        : { index: true, follow: true },
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Ballot",
        url: pollUrl,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: poll.question,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return {
      title: "Ballot — Modern, Real-time Polling",
      description: "Vote anonymously with zero signup required on Ballot.",
    };
  }
}

export default function PollLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

