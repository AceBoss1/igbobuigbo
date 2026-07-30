// app/privacy/page.tsx
import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Igbo Bu Igbo' };

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
      <div className="container" style={{ maxWidth: 780 }}>

        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="section-label">Legal</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Last updated: July 2026</p>
        </div>

        <div style={{ padding: 'var(--space-lg)', background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2xl)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong>Note:</strong> This policy describes, accurately and in plain language, what data the Igbo Bu Igbo
            Unity &amp; Cultural Preservation Initiative ("IBI", "we", "us") actually collects and how it is actually
            used, based on how the platform is built. It is a working document intended for legal counsel review
            before mass member registration, particularly given the platform's wallet and payment features. It is
            not a substitute for advice from a qualified lawyer.
          </p>
        </div>

        <Section title="1. Who We Are">
          <p>Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative operates igbobuigbo.org.ng, connecting Igbo
          people across 43 chapters, 3 regions, and 5 continents. For any privacy question, contact
          info@igbobuigbo.org.ng or +234 (0) 806 787 1203.</p>
        </Section>

        <Section title="2. Information We Collect">
          <SubHeading>Provided directly by you</SubHeading>
          <ul>
            <li>Registration details: full name, email, phone number, chapter/location, date of birth</li>
            <li>Profile details: profile photo, blood type, next-of-kin / emergency contact name, relationship, phone, and email</li>
            <li>Payment-related details processed via Paystack (see §4) — IBI itself does not store your card number</li>
            <li>Content you submit: contact-form messages, marketplace listings, donation messages</li>
          </ul>
          <SubHeading>Collected automatically</SubHeading>
          <ul>
            <li>Login session data via a short-lived authentication cookie, used only to keep you signed in</li>
            <li>Basic technical data standard to any web request (IP address, browser type) via our hosting provider's logs</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul>
            <li>To create and administer your membership account, ID card, and chapter assignment</li>
            <li>To process payments, wallet top-ups, donations, and card orders, and to keep accurate financial records of them</li>
            <li>To send transactional email and SMS: welcome messages, approval notices, payment receipts, verification links, and password resets</li>
            <li>To calculate and pay affiliate commissions when you refer other members</li>
            <li>To respond to support requests submitted via the contact form</li>
            <li>To detect and prevent fraud, abuse, or violations of the Terms of Use</li>
          </ul>
          <p>We do not sell your personal data.</p>
        </Section>

        <Section title="4. Third Parties We Share Data With">
          <p>We use the following processors to operate the platform. Each only receives the data it needs to
          perform its specific function:</p>
          <ul>
            <li><strong>Google Firebase</strong> (Authentication &amp; database) — hosts your account credentials and membership records</li>
            <li><strong>Paystack</strong> (payments) — processes card payments; IBI never sees or stores your full card number</li>
            <li><strong>Cloudinary</strong> (media hosting) — stores profile photos and ID card images</li>
            <li><strong>Brevo</strong> (email delivery) — sends transactional emails on our behalf</li>
            <li><strong>Termii</strong> (SMS delivery) — sends transactional SMS/WhatsApp on our behalf</li>
            <li><strong>Vercel</strong> (hosting) — serves the website and processes requests</li>
          </ul>
          <p>We do not permit any of these processors to use your data for their own marketing purposes.</p>
        </Section>

        <Section title="5. International Data Transfer">
          <p>IBI connects members across five continents. Because our infrastructure providers (Google, Vercel, and
          others) operate global networks, your data may be processed in countries other than the one you live in,
          including outside Nigeria. We select providers that maintain industry-standard security practices for
          any such transfer.</p>
        </Section>

        <Section title="6. Data Retention">
          <p>We retain membership and transaction records for as long as your account is active and for a
          reasonable period afterward to meet financial record-keeping and legal obligations. You may request
          deletion of your account as described in §7, subject to records we're required to keep for financial
          or legal compliance (e.g. transaction history).</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on where you live, you may have rights to access, correct, export, or request deletion of
          your personal data. To exercise any of these, email info@igbobuigbo.org.ng with your registered email
          address and IBI number. We will respond within a reasonable time.</p>
        </Section>

        <Section title="8. Children">
          <p>IBI membership is limited to individuals aged 18 and older. We do not knowingly collect data from
          anyone under 18.</p>
        </Section>

        <Section title="9. Security">
          <p>We use industry-standard measures — encrypted connections, access-controlled databases, and
          server-side verification of payments — to protect your data. No system is perfectly secure, and we
          cannot guarantee absolute security.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this policy as the platform evolves — for example, when identity verification (KYC) is
          introduced. Material changes will be posted here with an updated date.</p>
        </Section>

        <Section title="11. Contact">
          <p>Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative<br/>
          info@igbobuigbo.org.ng · +234 (0) 806 787 1203<br/>
          igbobuigbo.org.ng</p>
        </Section>

        <p style={{ marginTop: 'var(--space-2xl)', fontSize: '0.85rem' }}>
          See also our <Link href="/terms" style={{ color: 'var(--ibi-gold)' }}>Terms of Use</Link>.
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
function SubHeading({ children }: { children: React.ReactNode }) {
  return <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{children}</p>;
}
