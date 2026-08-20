import type { Metadata } from "next";
import { db } from "@/db";
import { polls } from "@/db/schema";
import { eq } from "drizzle-orm";

type Props = {
  params: { slug: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);

    if (!poll) {
      return {
        title: "Poll Not Found — Ballot",
        description: "This poll may have been deleted or does not exist.",
      };
    }

    const title = `🗳️ ${poll.question} — Ballot`;
    const description = poll.description
      ? `${poll.description.slice(0, 120)} · Cast your vote on Ballot (no signup required)`
      : "Cast your vote on Ballot · 100% free, real-time results, zero signup required.";
    const ogImageUrl = `/api/og/${params.slug}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Ballot",
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
