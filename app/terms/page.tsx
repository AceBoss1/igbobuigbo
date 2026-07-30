// app/terms/page.tsx
import Link from 'next/link';

export const metadata = { title: 'Terms of Use — Igbo Bu Igbo' };

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
      <div className="container" style={{ maxWidth: 780 }}>

        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="section-label">Legal</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', marginBottom: 8 }}>Terms of Use</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Last updated: July 2026</p>
        </div>

        <div style={{ padding: 'var(--space-lg)', background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2xl)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong>Note:</strong> This is a working draft of the platform's Terms of Use, written to accurately
            reflect how membership, the wallet, and payments actually work today. It is intended for legal counsel
            review before mass member registration, particularly the wallet and payment sections. It is not a
            substitute for advice from a qualified lawyer.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>By registering for membership or otherwise using igbobuigbo.org.ng (the "Platform"), operated by
          Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative ("IBI", "we", "us"), you agree to these Terms
          of Use and our <Link href="/privacy" style={{ color:'var(--ibi-gold)' }}>Privacy Policy</Link>.</p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 18 years old to register. By registering, you confirm the information you
          provide is accurate and that you are the person you claim to be.</p>
        </Section>

        <Section title="3. Membership Tiers &amp; Fees">
          <ul>
            <li>Student and Youth tiers are free, subject to age/status eligibility, and expire when that eligibility ends (e.g. graduation, turning 26/36).</li>
            <li>Professional, Business, Diaspora, and Patron tiers require a one-time lifetime registration fee. Current fees are shown on the Membership page at the time of registration.</li>
            <li><strong>Registration fees are non-refundable</strong> once your membership is approved, except where required by applicable law.</li>
            <li>IBI reserves the right to change registration fees and benefits for future registrations; fees already paid are not retroactively affected.</li>
          </ul>
        </Section>

        <Section title="4. IBI Wallet">
          <ul>
            <li>The IBI Wallet is an internal balance for use within the Platform (card orders, tier upgrades, donations). <strong>It is not a bank account or deposit product</strong>, does not earn interest, and is not covered by deposit insurance.</li>
            <li>Wallet top-ups made by card are processed via Paystack and verified against Paystack's own transaction record before your balance is credited.</li>
            <li>IBI may restrict or suspend wallet functionality on an account under active security review (e.g. suspected fraud or unauthorized access). During a restriction, your balance remains visible and intact — restriction affects your ability to spend or transfer, not your ownership of the balance.</li>
            <li>Wallet credits and debits performed by IBI administrators for account corrections are logged and require appropriate administrative authorization.</li>
            <li>You are responsible for keeping your account credentials secure. IBI is not liable for losses resulting from unauthorized access caused by your failure to safeguard your login details.</li>
          </ul>
        </Section>

        <Section title="5. Donations">
          <ul>
            <li>Donations made through the Platform are voluntary contributions to the selected cause and are <strong>non-refundable</strong> once processed.</li>
            <li>IBI directs donations toward the stated cause but retains discretion over specific allocation within that cause's programs.</li>
          </ul>
        </Section>

        <Section title="6. ID Cards &amp; Card Orders">
          <p>Digital ID cards are provided free with membership. Physical or premium virtual card orders are
          subject to the fee shown at time of order and are fulfilled as described on the order page. Card orders
          are non-refundable once production/issuance has begun.</p>
        </Section>

        <Section title="7. Affiliate Program">
          <ul>
            <li>Members may earn commission on paid registrations and marketplace sales referred through their personal affiliate link, at the rate shown on the Affiliate dashboard at the time of the referred transaction.</li>
            <li>Commission is paid only on legitimate referrals. Self-referral, fake accounts, or other manipulation of the affiliate program is prohibited and may result in forfeiture of commission and/or account suspension.</li>
          </ul>
        </Section>

        <Section title="8. Prohibited Conduct">
          <p>You agree not to: provide false information during registration; attempt to access another member's
          account or data without authorization; interfere with or attempt to manipulate the Platform's payment,
          wallet, or affiliate systems; use the Platform for any unlawful purpose; or harass, defraud, or abuse
          other members.</p>
        </Section>

        <Section title="9. Identity Verification (KYC)">
          <p>As IBI's financial features expand, we plan to introduce identity verification through a licensed
          KYC partner. Once introduced, continued access to certain wallet features may require completing
          verification. We will provide advance notice before any such requirement takes effect.</p>
        </Section>

        <Section title="10. Suspension &amp; Termination">
          <p>IBI may suspend or terminate an account that violates these Terms, is used fraudulently, or poses a
          security risk to the Platform or other members. Where reasonably possible, we will notify you of the
          reason.</p>
        </Section>

        <Section title="11. Disclaimer &amp; Limitation of Liability">
          <p>The Platform is provided "as is." To the fullest extent permitted by law, IBI is not liable for
          indirect, incidental, or consequential damages arising from your use of the Platform, including
          third-party payment or delivery failures outside our reasonable control.</p>
        </Section>

        <Section title="12. Governing Law">
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising from
          these Terms will first be attempted to be resolved informally by contacting info@igbobuigbo.org.ng.</p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>We may update these Terms as the Platform evolves. Material changes will be posted here with an
          updated date; continued use of the Platform after changes take effect constitutes acceptance.</p>
        </Section>

        <Section title="14. Contact">
          <p>Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative<br/>
          info@igbobuigbo.org.ng · +234 (0) 806 787 1203<br/>
          igbobuigbo.org.ng</p>
        </Section>

        <p style={{ marginTop: 'var(--space-2xl)', fontSize: '0.85rem' }}>
          See also our <Link href="/privacy" style={{ color: 'var(--ibi-gold)' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <h2 style={{ fontSize: '1.05rem', marginBottom: 10, color: 'var(--ibi-gold)' }}>{title}</h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
