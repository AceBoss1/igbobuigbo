// app/api/qr/route.ts
// Server-side real scannable QR code generator. Called by ID card for verify QR.
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  // No auth on this route by design (ID card rendering needs it
  // unauthenticated), and it accepts arbitrary text with no content
  // validation — without a rate limit, it's a free, unauthenticated
  // image-generation service for ANY content, hosted under a trusted
  // domain (usable to generate a "legitimate-looking" QR pointing
  // anywhere), plus uncapped compute/bandwidth cost per request.
  const limited = await rateLimitByIp(req, 'qr', 60, 60);
  if (limited) return NextResponse.json(limited.body, { status: limited.status });

  const url  = new URL(req.url);
  const data = url.searchParams.get('data');
  if (!data) return NextResponse.json({ error: 'data param required' }, { status: 400 });

  try {
    const png = await QRCode.toBuffer(data, {
      type:                'png',
      width:               200,
      margin:              1,
      color:               { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });

    // NextResponse requires BodyInit (Uint8Array), not Node.js Buffer.
    // new Uint8Array(png.buffer) converts without copying the underlying memory.
    return new Response(png.buffer as ArrayBuffer, {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
