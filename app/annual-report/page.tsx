// app/annual-report/page.tsx
export const metadata = { title: 'Annual Reports — Igbo Bu Igbo' };

export default function AnnualReportPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ textAlign: 'center', maxWidth: 520, padding: '0 var(--space-lg)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 20 }}>📊</div>
        <div className="section-label">Transparency</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: 16 }}>IBI Annual Reports</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          You'll be able to view IBI's Annual Reports on this page once available, starting
          from <strong>January 25, 2027</strong>.
        </p>
        <a href="/" className="btn btn-primary" style={{ marginTop: 24 }}>Back to Home</a>
      </div>
    </div>
  );
}
