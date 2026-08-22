import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Ballot",
  description: "Learn how Ballot protects your privacy, uses cookies for voting deduplication, and handles data responsibly.",
};

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <Navbar />

      <main style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 60 }}>
        <div className="section-label">LEGAL</div>
        <h1 className="poll-title" style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
          Last updated: August 22, 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, lineHeight: 1.7, fontSize: 14, color: "var(--ink)" }}>
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>1. Overview & Commitment</h2>
            <p style={{ color: "var(--muted)" }}>
              At <strong>Ballot</strong> (accessible from{" "}
              <a href="https://ballot-poll.vercel.app" style={{ color: "var(--accent)" }}>
                https://ballot-poll.vercel.app
              </a>
              ), we believe participating in public decisions and surveys should not require surrendering your personal identity. This Privacy Policy outlines what information we collect, how it is used, and how advertising partners like Google AdSense process data.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>2. Cookies & Local Storage</h2>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>
              Ballot uses minimal cookies and local storage tokens strictly necessary to provide the service:
            </p>
            <ul style={{ paddingLeft: 20, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <strong>Voting Deduplication Tokens:</strong> We generate an anonymous client token stored in your browser cookie (`ballot_voter_token`) and compute a one-way salted cryptographic hash of request IP addresses to deter duplicate voting and bot manipulation. We do not store raw IP addresses linked to user identities.
              </li>
              <li>
                <strong>Session Authentication:</strong> If you choose to sign in as a verified creator via email OTP, a secure, HTTP-only session cookie is stored to keep you logged in.
              </li>
              <li>
                <strong>Theme Preferences:</strong> We store your dark/light theme preference locally in your browser (`ballot:theme`).
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>3. Third-Party Advertising & Google AdSense</h2>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>
              We display advertisements provided by <strong>Google AdSense</strong> to support the free operation of this service.
            </p>
            <ul style={{ paddingLeft: 20, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                Third-party vendors, including Google, use cookies to serve ads based on a user&apos;s prior visits to this website or other websites on the internet.
              </li>
              <li>
                Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to Ballot and/or other sites on the Internet.
              </li>
              <li>
                You may opt out of personalized advertising by visiting{" "}
                <a
                  href="https://g.co/adssettings"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Google Ads Settings (g.co/adssettings)
                </a>
                .
              </li>
              <li>
                To learn more about how Google uses data when you use partner sites, visit{" "}
                <a
                  href="https://policies.google.com/technologies/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Google&apos;s Advertising Privacy & Terms
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>4. Information Collected on Poll Creation & Voting</h2>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>
              When using Ballot, the following data is processed:
            </p>
            <ul style={{ paddingLeft: 20, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <strong>Poll Creators:</strong> When creating a poll, we store the question text, option labels, uploaded images, configuration settings (e.g. ranked choice, expiry dates), and your account ID if logged in.
              </li>
              <li>
                <strong>Voters:</strong> When voting, we store the selected option IDs, timestamps, and an anonymous voter digest to compute aggregated tallies. If a poll creator requires a voter name, the name you enter is visible to that poll&apos;s creator.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>5. Public vs. Unlisted Poll Visibility</h2>
            <ul style={{ paddingLeft: 20, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <strong>Community / Public Polls (`BPC-`):</strong> Are indexed in the public Explore directory, searchable, and viewable by any internet visitor.
              </li>
              <li>
                <strong>Private / Unlisted Polls (`BPP-`):</strong> Are excluded from the Explore feed and tagged with `noindex` robots directives to prevent search engine indexing. Anyone with the direct link may view and vote.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>6. No Sale of Personal Data</h2>
            <p style={{ color: "var(--muted)" }}>
              We do <strong>not</strong> sell, rent, or trade your personal voting records, individual choices, or contact information to any third parties or data brokers.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>7. Changes to This Policy</h2>
            <p style={{ color: "var(--muted)" }}>
              We may update this Privacy Policy periodically to reflect new features or regulatory requirements. Material updates will be reflected with a revised &quot;Last updated&quot; date on this page.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>8. Contact Us</h2>
            <p style={{ color: "var(--muted)" }}>
              If you have any questions or privacy inquiries regarding Ballot, please reach out via our GitHub repository or contact our team directly at{" "}
              <a href="https://github.com/reconnest/Ballot.git" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                reconnest/Ballot
              </a>
              .
            </p>
          </section>
        </div>

        <Footer />
      </main>
    </div>
  );
}
