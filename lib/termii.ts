// lib/termii.ts
export async function sendSMS(to: string, sms: string, channel: 'generic' | 'dnd' | 'whatsapp' = 'generic') {
  // Normalize phone to international format
  const phone = to.startsWith('+')
    ? to
    : to.startsWith('0')
      ? `+234${to.slice(1)}`
      : `+234${to}`;

  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to:          phone,
      from:        'Igbobuigbo',
      sms,
      type:        'plain',
      channel,
      api_key:     process.env.TERMII_API_KEY!,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Termii SMS error:', err);
    // Don't throw — SMS failure should not block main flow
    return null;
  }

  return res.json();
}

export async function sendOTP(phone: string) {
  const normalized = phone.startsWith('+')
    ? phone
    : phone.startsWith('0')
      ? `+234${phone.slice(1)}`
      : `+234${phone}`;

  const res = await fetch('https://api.ng.termii.com/api/sms/otp/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:     process.env.TERMII_API_KEY!,
      message_type:'NUMERIC',
      to:          normalized,
      from:        'Igbobuigbo',
      channel:     'generic',
      pin_attempts: 3,
      pin_time_to_live: 10,
      pin_length:  6,
      pin_placeholder: '< 1234 >',
      message_text:'Your IBI verification code is < 1234 >. Valid for 10 minutes. Do not share.',
      pin_type:    'NUMERIC',
    }),
  });

  return res.json() as Promise<{ pinId: string; to: string; smsStatus: string }>;
}

export async function verifyOTP(pinId: string, pin: string) {
  const res = await fetch('https://api.ng.termii.com/api/sms/otp/verify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TERMII_API_KEY!, pin_id: pinId, pin }),
  });
  return res.json() as Promise<{ verified: boolean; msisdn: string }>;
}
