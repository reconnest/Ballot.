import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ballot — Modern, Ad-Free Polling Engine",
  description: "Create real-time polls with ranked-choice voting, 3-tier anti-fraud protection, and interactive SVG analytics in seconds. No account required.",
  openGraph: {
    title: "Ballot — Modern, Ad-Free Polling Engine",
    description: "Create real-time polls with ranked-choice voting, 3-tier anti-fraud protection, and interactive SVG analytics in seconds.",
    url: "https://ballot-phi.vercel.app",
    siteName: "Ballot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ballot — Modern, Ad-Free Polling Engine",
    description: "Create real-time polls with ranked-choice voting, 3-tier anti-fraud protection, and interactive SVG analytics in seconds.",
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
