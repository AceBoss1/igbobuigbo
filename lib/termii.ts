// lib/termii.ts
function normalizePhone(to: string): string {
  const clean = to.replace(/[\s\-()]/g,'');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return `+234${clean.slice(1)}`;
  return `+234${clean}`;
}

export async function sendSMS(to: string, sms: string) {
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) {
    console.log(`[Termii] SMS NOT sent (no API key). Would have sent to ${to}: ${sms.slice(0,50)}…`);
    return null; // gracefully skip
  }
  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ to:normalizePhone(to), from:'Igbobuigbo', sms, type:'plain', channel:'generic', api_key:apiKey }),
  });
  if (!res.ok) console.error('Termii error:', await res.text());
  return res.ok ? res.json() : null;
}

export async function sendOTP(phone: string) {
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) { console.log('[Termii] OTP skipped — no API key'); return { pinId:'NO_OTP', to:phone, smsStatus:'skipped' }; }
  const res = await fetch('https://api.ng.termii.com/api/sms/otp/send', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      api_key:apiKey, message_type:'NUMERIC', to:normalizePhone(phone),
      from:'Igbobuigbo', channel:'generic', pin_attempts:3, pin_time_to_live:10,
      pin_length:6, pin_placeholder:'< 1234 >',
      message_text:'Your IBI verification code is < 1234 >. Valid for 10 minutes.',
      pin_type:'NUMERIC',
    }),
  });
  return res.json();
}

export async function verifyOTP(pinId: string, pin: string) {
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey || pinId === 'NO_OTP') return { verified:true, msisdn:'unknown' };
  const res = await fetch('https://api.ng.termii.com/api/sms/otp/verify', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ api_key:apiKey, pin_id:pinId, pin }),
  });
  return res.json();
}
