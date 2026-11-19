/**
 * AuditorBell.tsx — notification bell for the Auditor Portal topbar.
 * Shows: access approved / denied / pending, new submissions waiting for an auditor.
 */
import { useEffect, useRef, useState } from 'react';
import b from './AuditorBell.module.css';
import { useAuditorNotifications } from './auditorStore';
import { IconBell } from './icons';

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function AuditorBell({ onOpenQueue }: { onOpenQueue?: () => void }) {
  const { items, unread, seen, markAllRead } = useAuditorNotifications(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  return (
    <div className={b.wrap} ref={ref}>
      <button className={b.btn} title="Notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setOpen((o) => !o)}>
        <IconBell size={15} />
        {unread > 0 && <span className={b.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className={b.panel} role="dialog" aria-label="Notifications">
          <div className={b.head}>
            <span>Notifications</span>
            {unread > 0 && <button className={b.link} onClick={markAllRead}>Mark all read</button>}
          </div>
          {items.length === 0 ? <div className={b.empty}>You're all caught up.</div> : items.map((n) => (
            <div key={n.id} className={`${b.item} ${+new Date(n.at) > seen ? b.unread : ''}`} onClick={() => { setOpen(false); onOpenQueue?.(); }} style={{ cursor: 'pointer' }}>
              <span className={`${b.dot} ${b[n.kind]}`} />
              <div><div className={b.title}>{n.title}</div><div className={b.detail}>{n.detail}</div><div className={b.time}>{ago(n.at)}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
