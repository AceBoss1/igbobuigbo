// components/dashboard/NotificationBell.tsx
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface Notif {
  id: string; title: string; body: string; link: string | null;
  type: string; read: boolean; createdAt: string | null;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* silent — non-critical */ }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    // Simple polling for v1 — a real-time onSnapshot listener would be
    // nicer but adds a client Firestore dependency for something that
    // works fine with a 45s poll at current scale.
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    const token = await user.getIdToken();
    fetch('/api/notifications/mark-read', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  };

  const openBell = () => {
    setOpen(o => !o);
    if (!open) markAllRead();
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={openBell} aria-label="Notifications" style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-secondary)', fontSize: '1.15rem',
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8,
            background: 'var(--ibi-red)', color: '#fff', fontSize: '0.62rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, width: 340, maxHeight: 420, overflowY: 'auto',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', zIndex: 999,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.85rem' }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No notifications yet
            </div>
          ) : (
            items.map(n => (
              <a key={n.id} href={n.link ?? '#'} style={{
                display: 'block', padding: '12px 16px', textDecoration: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                background: n.read ? 'transparent' : 'rgba(212,175,55,0.05)',
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</div>
                {n.createdAt && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                )}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
