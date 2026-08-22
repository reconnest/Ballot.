import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ballot-poll.vercel.app"),
  title: "Ballot — Modern Real-Time Polling",
  description: "Create, share and vote on modern polls with ranked choice voting, live results, analytics and powerful vote protection.",
  openGraph: {
    title: "Ballot — Modern Real-Time Polling",
    description: "Create, share and vote on modern polls with ranked choice voting, live results, analytics and powerful vote protection.",
    url: "https://ballot-poll.vercel.app",
    siteName: "Ballot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ballot — Modern Real-Time Polling",
    description: "Create, share and vote on modern polls with ranked choice voting, live results, analytics and powerful vote protection.",
  },
};




export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

