/**
 * src/pages/dashboard/NotificationBell.tsx
 * Header bell: live feed of review / access / auditor activity with an unread badge.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icons';
import { timeAgo, type Notice } from './dashboardApi';
import x from './DashboardExtras.module.css';

const KIND_ICON: Record<Notice['kind'], IconName> = { success: 'checkCircle', warning: 'alert', info: 'info', danger: 'alert' };

export function NoticeRow({ n, unread, onClick }: { n: Notice; unread: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`${x.notice} ${unread ? x.noticeUnread : ''}`} onClick={onClick}>
      <span className={`${x.nIcon} ${x['k_' + n.kind]}`}><Icon name={KIND_ICON[n.kind]} size={15} /></span>
      <span className={x.nBody}>
        <span className={x.nTitle}>{n.title}</span>
        <span className={x.nDetail} style={{ display: 'block' }}>{n.detail}</span>
        <span className={x.nTime} style={{ display: 'block' }}>{timeAgo(n.at)}</span>
      </span>
    </button>
  );
}

interface Props { notices: Notice[]; unread: number; seenAt: number; onOpen: () => void; onMarkRead: () => void; onRefresh: () => void }

export function NotificationBell({ notices, unread, seenAt, onOpen, onMarkRead, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className={x.bellWrap} ref={ref}>
      <button type="button" className={`${x.bellBtn} ${open ? x.bellOpen : ''}`} title="Notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open} onClick={() => { setOpen((v) => !v); if (!open) { onOpen(); onRefresh(); } }}>
        <Icon name="bell" size={16} />
        {unread > 0 && <span className={x.bellCount}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className={x.drop} role="dialog" aria-label="Notifications">
          <div className={x.dropHead}>
            <span className={x.dropTitle}>Notifications</span>
            {unread > 0 && <button type="button" className={x.dropLink} onClick={onMarkRead}>Mark all read</button>}
          </div>
          <div className={x.dropList}>
            {notices.length === 0 ? (
              <div className={x.dropEmpty}><Icon name="bell" size={22} />You're all caught up.</div>
            ) : notices.map((n) => (
              <NoticeRow key={n.id} n={n} unread={+new Date(n.at) > seenAt}
                onClick={() => { setOpen(false); if (n.link) navigate(n.link); }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
