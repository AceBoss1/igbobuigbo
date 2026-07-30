// app/api/admin/notifications/route.ts
// Admin composes and sends a notification — to one member (by uid/IBI
// number lookup, resolved client-side before calling this) or to
// everyone. Also the intended hook point for a future "IBI Ads" push
// feature Emmanuel mentioned — same data model, just a different `type`
// and audience targeting, no schema change needed when that's built.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { createNotification, notifyRegion, notifyChapter } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { title, body, link, audience, targetUid, regionId, chapterName } = await req.json();
    if (!title || !body) return NextResponse.json({ error: 'title and body are required' }, { status: 400 });

    if (audience === 'all' || audience === 'user') {
      if (audience === 'user' && !targetUid) {
        return NextResponse.json({ error: 'targetUid required for a targeted notification' }, { status: 400 });
      }
      await createNotification({ title, body, link, audience, targetUid, type: 'admin', createdBy: auth.uid });
      return NextResponse.json({ success: true });
    }

    if (audience === 'region') {
      if (!regionId) return NextResponse.json({ error: 'regionId required' }, { status: 400 });
      const count = await notifyRegion(regionId, title, body, link);
      return NextResponse.json({ success: true, recipientCount: count });
    }

    if (audience === 'chapter') {
      if (!chapterName) return NextResponse.json({ error: 'chapterName required' }, { status: 400 });
      const count = await notifyChapter(chapterName, title, body, link);
      return NextResponse.json({ success: true, recipientCount: count });
    }

    return NextResponse.json({ error: "audience must be 'all', 'user', 'region', or 'chapter'" }, { status: 400 });
  } catch (e: any) {
    console.error('[admin/notifications]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
