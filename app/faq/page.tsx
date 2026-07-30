// app/faq/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

const SECTIONS = [
  {
    title: 'Membership',
    items: [
      { q: 'Who can join Igbo Bu Igbo (IBI)?',
        a: 'Any person of Igbo heritage or descent, anywhere in the world, aged 18 or older. Students and Youth (18–25) can join free; Professional, Business, Diaspora, and Patron are paid, lifetime, one-time-fee tiers.' },
      { q: 'What do I get with a free (Student/Youth) membership?',
        a: 'A digital ID card, access to the IBI Marketplace and Directory, the newsletter, an IBI NGN Wallet, the Affiliate Program, access to grants/scholarships and escrow, the Job Board, and voting rights at a base weight.' },
      { q: 'What additional benefits come with a paid tier?',
        a: 'Everything in the free tier, plus a USD wallet alongside NGN, a business listing, a free virtual IBI debit card, eligibility to be voted for in IBI elections, verification-portal tokens, the ability to post (not just apply to) jobs, and a higher voting weight. Patron adds VIP support, a lifetime physical ID card, limited-edition debit cards, executive recognition, and annual summit access.' },
      { q: 'Is membership a subscription?',
        a: 'No. Every paid tier is a single, one-time lifetime fee — there is no recurring or annual renewal charge for membership itself.' },
      { q: 'What are my membership dues used for, and how are they classified?',
        a: 'Your one-time registration fee, and any annual or chapter dues introduced in future, are all classified as member contributions — the same category as donations and grants under IBI\u2019s constitution. They fund IBI\u2019s stated objectives: promoting Igbo unity and culture, supporting community development, empowering the less privileged, and encouraging education, youth development, and entrepreneurship. Every naira is tracked in a wallet ledger, independently verifiable at igbobuigbo.org.ng/verify.',
        linkText: 'Read the full constitution', linkHref: '/constitution' },
      { q: 'Current registration fees',
        a: 'Fees are set centrally and can change — the amounts shown at checkout on the Membership page are always the current, correct ones. Student and Youth are free.' },
      { q: 'How do I move to a different chapter?',
        a: 'Use the Chapter Transfer tool in your dashboard. Transfers are reviewed and do not change your membership tier or wallet balance.' },
    ],
  },
  {
    title: 'IBI Wallet',
    items: [
      { q: 'What is the IBI Wallet?',
        a: 'A digital balance tied to your membership account, usable to pay for things inside the platform — card orders, tier upgrades, and donations — as an alternative to paying by card via Paystack each time.' },
      { q: 'Is the IBI Wallet a bank account?',
        a: 'No. The IBI Wallet is an internal record of value usable within the IBI platform. It is not a deposit account, does not earn interest, and is not insured or regulated as a bank product. See the Terms of Use for the full wallet terms.' },
      { q: 'How do I add money to my wallet?',
        a: 'Top up from your dashboard using a card via Paystack. Every top-up is verified against Paystack directly before your balance is credited.' },
      { q: 'What happens if a payment succeeds but my balance doesn\u2019t update?',
        a: 'This should self-correct automatically — every payment path is checked server-side against Paystack\u2019s own record, and a background safety net catches the rare case where your browser closes right after paying. If your balance still looks wrong after a few minutes, contact support@igbobuigbo.org.ng with your payment reference.' },
      { q: 'Can my wallet be suspended?',
        a: 'IBI administrators can restrict wallet usage on an account if there\u2019s a security concern under investigation. If this happens, you can still see your balance — your funds are not lost — you just won\u2019t be able to spend or transfer until the restriction is lifted.' },
    ],
  },
  {
    title: 'Donations',
    items: [
      { q: 'What causes can I donate to?',
        a: 'General Fund, IBI Scholarship, Women Empowerment, IBI Tech Hub, and Disaster Relief. You can donate from the public donate page or, if logged in, directly from your dashboard without leaving it.' },
      { q: 'Are donations refundable?',
        a: 'No. Donations are final once processed, in line with standard non-profit practice — see the Terms of Use.' },
      { q: 'Do I get a receipt?',
        a: 'Yes, an automatic receipt is emailed to you (unless you donated anonymously without an email) showing the amount, cause, and reference number.' },
    ],
  },
  {
    title: 'ID Cards & Affiliate Program',
    items: [
      { q: 'How do I get my ID card?',
        a: 'Every member gets a free digital ID card immediately after approval, downloadable from your dashboard. Physical and premium virtual cards can be ordered for a fee.' },
      { q: 'How does the affiliate program work?',
        a: 'Share your personal referral link. When someone registers using it and their paid tier is approved, you earn a commission — a percentage of their registration fee, credited to your wallet. The current rate is shown on your Affiliate dashboard.' },
    ],
  },
  {
    title: 'Verification & Identity',
    items: [
      { q: 'Is IBI currently doing identity (KYC) verification?',
        a: 'Not yet at full scale. As the platform\u2019s financial features grow, IBI plans to introduce formal identity verification through a licensed KYC partner. When that goes live, some wallet features may require completing verification to continue — we\u2019ll notify affected members in advance.' },
    ],
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
      <div className="container" style={{ maxWidth: 820 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <div className="section-label">Support</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 12 }}>Frequently Asked Questions</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Can't find what you're looking for? <Link href="/contact" style={{ color: 'var(--ibi-gold)' }}>Contact us</Link>.
          </p>
        </div>

        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 'var(--space-2xl)' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-md)', color: 'var(--ibi-gold)' }}>{section.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map(({ q, a, linkText, linkHref }: any) => {
                const id = `${section.title}-${q}`;
                const isOpen = open === id;
                return (
                  <div key={id} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => setOpen(isOpen ? null : id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '14px 18px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                        color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600,
                      }}
                    >
                      {q}
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
                        {a}
                        {linkHref && (
                          <div style={{ marginTop: 8 }}>
                            <Link href={linkHref} style={{ color: 'var(--ibi-gold)', fontWeight: 600 }}>{linkText ?? 'Learn more →'}</Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)', padding: 'var(--space-lg)', background: 'rgba(212,175,55,0.04)', border: '1px dashed var(--border-gold)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            Still have questions? <Link href="/contact" style={{ color: 'var(--ibi-gold)', fontWeight: 600 }}>Reach out to the IBI team →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
