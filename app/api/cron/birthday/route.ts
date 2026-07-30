// app/api/cron/birthday/route.ts
// Called daily by an external cron (cron-job.org — free tier).
// Configure cron-job.org to call:
//   URL:    https://igbobuigbo.org.ng/api/cron/birthday
//   Method: GET
//   Header: x-cron-secret: {CRON_SECRET}
//   Time:   00:05 WAT (23:05 UTC previous day)
//
// EMAIL COST: Zero-cost via Gmail SMTP (mailer.igbobuigbo@gmail.com) for the
// first ~480 emails/day platform-wide. Once that's exceeded, automatically
// falls back to Brevo (paid) for the remainder — see lib/emailRouter.ts.
//
// SMS COST: Still routed through Termii (paid per SMS). To reach true
// zero-cost banking, SMS can be made opt-in or skipped during promotional
// "zero-charge season" — see the ENABLE_SMS flag below.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }       from '@/lib/firebase-admin';
import { sendEmailSmart } from '@/lib/emailRouter';
import { sendSMS }        from '@/lib/termii';

// Toggle to false during "zero-charge season" to skip paid SMS entirely
// (email-only birthday wishes, still 100% free via Gmail SMTP).
const ENABLE_SMS = true;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now    = new Date();
  const watNow = new Date(now.getTime() + 60 * 60 * 1000); // WAT = UTC+1
  const todayMonth = watNow.getUTCMonth() + 1;
  const todayDay   = watNow.getUTCDate();

  const snap = await adminDb.collection('members')
    .where('status', '==', 'active')
    .get();

  const todayBirthdays: {
    uid: string; name: string; email: string; phone?: string; ibiNumber: string;
  }[] = [];

  snap.forEach(doc => {
    const d = doc.data();
    if (!d.dob) return;
    try {
      const dob = new Date(d.dob);
      if ((dob.getMonth() + 1) === todayMonth && dob.getDate() === todayDay) {
        todayBirthdays.push({
          uid:       doc.id,
          name:      d.displayName ?? d.firstName ?? 'Valued Member',
          email:     d.email,
          phone:     d.phone,
          ibiNumber: d.ibiNumber ?? '',
        });
      }
    } catch { /* invalid dob — skip */ }
  });

  if (todayBirthdays.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'No birthdays today' });
  }

  let emailsSentGmail = 0;
  let emailsSentBrevo = 0;
  let smsSent         = 0;
  const CHUNK = 10;

  for (let i = 0; i < todayBirthdays.length; i += CHUNK) {
    const batch = todayBirthdays.slice(i, i + CHUNK);
    await Promise.allSettled(batch.map(async (member) => {
      // Email — smart-routed (Gmail free → Brevo fallback)
      try {
        const { provider } = await sendBirthdayEmail(member);
        provider === 'gmail' ? emailsSentGmail++ : emailsSentBrevo++;
      } catch (e) {
        console.error(`[birthday] Email failed for ${member.ibiNumber}:`, e);
      }

      // SMS — still paid via Termii, skip if ENABLE_SMS is false
      if (ENABLE_SMS && member.phone) {
        try {
          // member.phone is `string | undefined` on the wider type, but is
          // narrowed to `string` right here by the check above — TS doesn't
          // propagate that narrowing through the whole `member` object when
          // passed wholesale, so pass an explicit literal instead.
          await sendBirthdaySMS({ name: member.name, phone: member.phone, ibiNumber: member.ibiNumber });
          smsSent++;
        } catch (e) {
          console.error(`[birthday] SMS failed for ${member.ibiNumber}:`, e);
        }
      }
    }));
  }

  await adminDb.collection('cronLogs').add({
    type:            'birthday',
    date:            watNow.toISOString().slice(0, 10),
    totalBirthdays:  todayBirthdays.length,
    emailsSentGmail,
    emailsSentBrevo,
    smsSent,
    smsEnabled:      ENABLE_SMS,
    members:         todayBirthdays.map(m => m.ibiNumber),
    createdAt:       new Date(),
  });

  return NextResponse.json({
    success: true,
    total: todayBirthdays.length,
    emailsSentGmail,
    emailsSentBrevo,
    smsSent,
  });
}

// ─── Email (smart-routed) ──────────────────────────────────────────────────
async function sendBirthdayEmail(member: { name: string; email: string; ibiNumber: string }) {
  const firstName = member.name.split(' ')[0];
  return sendEmailSmart({
    to:      member.email,
    subject: `🎂 Happy Birthday, ${firstName}! — From Team IBI`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 16px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;">

              <tr><td style="background:linear-gradient(135deg,#8B1A1A 0%,#C8102E 100%);padding:40px 32px;text-align:center;">
                <img src="https://res.cloudinary.com/djj49cetb/image/upload/v1782343533/logo_rbsnrr.png"
                     alt="IBI" width="80" height="80"
                     style="border-radius:50%;border:3px solid #D4AF37;display:block;margin:0 auto 16px;">
                <h1 style="color:#fff;margin:8px 0 4px;font-size:24px;font-weight:800;letter-spacing:1px;">IGBO BU IGBO</h1>
                <p style="color:#D4AF37;margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                  Unity &amp; Cultural Preservation Initiative
                </p>
              </td></tr>

              <tr><td style="background:#D4AF37;padding:16px 32px;text-align:center;">
                <p style="margin:0;font-size:28px;">🎂 🎉 🎊</p>
                <p style="margin:4px 0 0;font-weight:800;color:#1a0005;font-size:18px;letter-spacing:1px;">HAPPY BIRTHDAY!</p>
              </td></tr>

              <tr><td style="padding:40px 32px;">
                <p style="margin:0 0 16px;font-size:17px;color:#1a0005;font-weight:700;">Dear ${firstName},</p>
                <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                  On behalf of the entire <strong>Igbo Bu Igbo</strong> family — across all
                  43 chapters, 3 regions, and 5 continents — we celebrate you on this special day! 🌍
                </p>
                <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                  May this new year of your life bring you <strong>joy, good health,
                  prosperity, and the enduring warmth of our Igbo brotherhood.</strong>
                </p>
                <p style="margin:0 0 24px;font-size:17px;color:#8B1A1A;font-weight:700;font-style:italic;text-align:center;">
                  "Onye wetara oji wetara ndụ" 🌿
                </p>

                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td style="background:linear-gradient(135deg,#1a0005,#2d0010);border-radius:12px;padding:24px;text-align:center;">
                    <p style="margin:0 0 4px;color:#D4AF37;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Member Since</p>
                    <p style="margin:0 0 16px;color:#fff;font-size:16px;font-weight:700;">${member.ibiNumber}</p>
                    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.6;">
                      Log in to your dashboard to explore your<br>member benefits on your special day.
                    </p>
                  </td>
                </tr></table>
              </td></tr>

              <tr><td style="padding:0 32px 40px;text-align:center;">
                <a href="https://igbobuigbo.org.ng/dashboard/overview"
                   style="display:inline-block;background:#D4AF37;color:#1a0005;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:50px;">
                  Visit My Dashboard →
                </a>
                <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">With love &amp; Igbo pride,<br>
                  <strong style="color:#8B1A1A;">Team IBI</strong></p>
              </td></tr>

              <tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative<br>
                  National Secretariat, Enugu, Nigeria<br>
                  <a href="https://igbobuigbo.org.ng" style="color:#8B1A1A;">igbobuigbo.org.ng</a>
                </p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}

// ─── SMS (Termii — paid, gated by ENABLE_SMS) ─────────────────────────────────
async function sendBirthdaySMS(member: { name: string; phone: string; ibiNumber: string }) {
  const firstName = member.name.split(' ')[0];
  await sendSMS(
    member.phone,
    `Happy Birthday ${firstName}! 🎂 On behalf of the entire Igbo Bu Igbo family, we celebrate you today! May this year bring you joy, health & Igbo pride. Log in: igbobuigbo.org.ng — Team IBI`,
  );
}
