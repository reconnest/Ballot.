import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — Ballot",
  description: "Terms and conditions governing the use of the Ballot polling platform.",
};

export default function TermsPage() {
  return (
    <div className="wrap">
      <Navbar />

      <main style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 60 }}>
        <div className="section-label">LEGAL</div>
        <h1 className="poll-title" style={{ fontSize: 28, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
          Last updated: August 22, 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, lineHeight: 1.7, fontSize: 14, color: "var(--ink)" }}>
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>1. Acceptance of Terms</h2>
            <p style={{ color: "var(--muted)" }}>
              By accessing or using <strong>Ballot</strong> (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue using the platform.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>2. Use of Service & No Account Requirement</h2>
            <p style={{ color: "var(--muted)" }}>
              Ballot allows users to create and vote on polls without requiring an account. You may optionally sign in via email verification to manage and claim your creator polls. You agree to provide accurate information and maintain the confidentiality of any administration credentials or private management links provided to you.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>3. Acceptable Use Policy</h2>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>
              You agree not to create, publish, or share polls or options that contain:
            </p>
            <ul style={{ paddingLeft: 20, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or libelous content.</li>
              <li>Hate speech or content promoting violence, discrimination, or harm against any individual or group based on race, religion, gender, sexual orientation, disability, or nationality.</li>
              <li>Spam, automated voter manipulation scripts, denial-of-service attempts, or unauthorized commercial solicitation.</li>
              <li>Content that infringes any patent, trademark, trade secret, copyright, or other proprietary rights of any party.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>4. Public Content & Right to Moderate</h2>
            <p style={{ color: "var(--muted)" }}>
              Polls published under public status are accessible to all visitors and may appear on public explore feeds and search engines. We reserve the right, but are under no obligation, to monitor, edit, disable, or remove any poll, vote, or user account at our sole discretion, with or without prior notice, for conduct that violates these Terms or is otherwise harmful to the community.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>5. Third-Party Advertisements</h2>
            <p style={{ color: "var(--muted)" }}>
              The Service may display advertisements served by third-party advertising networks, including Google AdSense. Your interactions with any third-party advertisers found on or through the Service are solely between you and the respective advertiser.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>6. Disclaimer of Warranties (&quot;As-Is&quot;)</h2>
            <p style={{ color: "var(--muted)" }}>
              The Service is provided on an <strong>&quot;AS IS&quot;</strong> and <strong>&quot;AS AVAILABLE&quot;</strong> basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We make no warranty that the service will meet your requirements, operate uninterrupted, or be error-free.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>7. Limitation of Liability</h2>
            <p style={{ color: "var(--muted)" }}>
              In no event shall Ballot, its maintainers, or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>8. Contact & Feedback</h2>
            <p style={{ color: "var(--muted)" }}>
              If you have any questions or feedback regarding these Terms, please contact us via our project repository at{" "}
              <a href="https://github.com/reconnest/Ballot.git" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                https://github.com/reconnest/Ballot.git
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
