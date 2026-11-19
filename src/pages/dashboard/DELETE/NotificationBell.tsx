/**
 * src/pages/dashboard/NotificationBell.tsx
 * Bell button + dropdown. Same button look as before (.iconBtn) — now with live data.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icons';
import { useNotifications, timeAgo, type AppNotification } from '@/hooks/useNotifications';
import headerStyles from './DashboardHeader.module.css';
import styles from './NotificationBell.module.css';

const TYPE_META: Record<AppNotification['type'], { icon: string; color: string; label: string }> = {
  review:   { icon: 'clipboard',   color: '#7C3AED', label: 'Review'   },
  request:  { icon: 'inbox',       color: '#D97706', label: 'Request'  },
  approval: { icon: 'checkCircle', color: '#059669', label: 'Approval' },
  document: { icon: 'fileText',    color: '#2563EB', label: 'Document' },
  system:   { icon: 'bell',        color: '#8B85A8', label: 'System'   },
};

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const openItem = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={headerStyles.iconBtn}
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Icon name="bell" size={16} />
        {unreadCount > 0 && <span className={styles.count}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <span className={styles.menuTitle}>Notifications</span>
            {unreadCount > 0 && <button className={styles.markAll} onClick={markAllRead}>Mark all read</button>}
          </div>

          <div className={styles.list}>
            {items.length === 0 && (
              <div className={styles.empty}>
                <Icon name="inbox" size={22} />
                <span>You're all caught up</span>
              </div>
            )}
            {items.map(n => {
              const m = TYPE_META[n.type] ?? TYPE_META.system;
              return (
                <button key={n.id} className={`${styles.item} ${n.read ? '' : styles.unread}`} onClick={() => openItem(n)}>
                  <span className={styles.itemIcon} style={{ background: `${m.color}14`, color: m.color }}>
                    <Icon name={m.icon} size={14} />
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTop}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {n.priority === 'high' && <span className={styles.high}>Urgent</span>}
                    </span>
                    {n.body && <span className={styles.itemText}>{n.body}</span>}
                    <span className={styles.itemMeta}>
                      {n.sender_name ? `${n.sender_name}${n.sender_role ? ` · ${n.sender_role}` : ''} · ` : ''}
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                  {!n.read && <span className={styles.dot} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
