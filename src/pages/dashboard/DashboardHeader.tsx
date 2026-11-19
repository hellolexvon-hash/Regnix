/**
 * src/pages/dashboard/DashboardHeader.tsx
 * Real user name/role from Supabase profile. Same layout as before — emojis replaced by
 * vector icons, and the bell now shows live review / access / auditor notifications.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Icon, AgentMark } from './Icons';
import { NotificationBell } from './NotificationBell';
import { useNotifications } from './dashboardApi';
import styles from './DashboardHeader.module.css';

interface Props {
  onAiToggle: () => void;
  aiOpen: boolean;
}

export function DashboardHeader({ onAiToggle, aiOpen }: Props) {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const { notices, unread, seenAt, refresh, markAllRead } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = profile?.full_name || user?.email || 'User';
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const role        = profile?.account_type === 'company' ? 'VP Compliance' : 'Client';

  return (
    <header className={styles.header}>
      <div className={styles.breadcrumb}>
        <span className={styles.breadRoot}>Regnix</span>
        <span className={styles.breadSep}>›</span>
        <span className={styles.breadCurrent}>Dashboard</span>
      </div>

      <div className={styles.right}>
        <div className={styles.search}>
          <span className={styles.searchIcon}><Icon name="search" size={14} /></span>
          <input className={styles.searchInput} placeholder="Search modules, tasks…" aria-label="Search" />
          <kbd className={styles.kbd}>⌘K</kbd>
        </div>

        <button
          className={`${styles.aiToggleBtn} ${aiOpen ? styles.aiToggleActive : ''}`}
          onClick={onAiToggle}
          title="AI Compliance Assistant"
        >
          <AgentMark size={14} />
          <span>AI Compliance Assistant</span>
        </button>

        <button className={styles.iconBtn} title="Compliance Calendar" aria-label="Compliance Calendar" onClick={() => navigate('/dashboard/calendar')}>
          <Icon name="calendar" size={16} />
        </button>

        <NotificationBell
          notices={notices} unread={unread} seenAt={seenAt}
          onOpen={() => undefined} onMarkRead={markAllRead} onRefresh={refresh}
        />

        <div className={styles.userMenu}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{displayName}</p>
            <p className={styles.userRole}>{role}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
