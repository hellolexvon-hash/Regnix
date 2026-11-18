/**
 * src/pages/dashboard/DashboardHeader.tsx
 * Same layout as before. Emojis replaced by SVG icons; bell is now a live
 * notification dropdown (reviews/requests from admins & auditors).
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icons';
import { AiOrb } from './AiAssistantPanel';
import { NotificationBell } from './NotificationBell';
import styles from './DashboardHeader.module.css';

interface Props {
  onAiToggle: () => void;
  aiOpen: boolean;
  /** Current dashboard section id, used for the breadcrumb */
  activeView?: string;
}

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', calendar: 'Compliance Calendar', generator: 'Document Generator',
  checker: 'Applicability Checker', planner: 'Audit Planner', documents: 'Documents',
  library: 'E-Library', reports: 'Analytics & Reports', tasks: 'Tasks & Workflow',
  notifications: 'Notifications', settings: 'Settings',
};

export function DashboardHeader({ onAiToggle, aiOpen, activeView = 'dashboard' }: Props) {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

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
        <span className={styles.breadSep}><Icon name="chevronRight" size={12} /></span>
        <span className={styles.breadCurrent}>{VIEW_LABELS[activeView] ?? 'Dashboard'}</span>
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
          aria-pressed={aiOpen}
        >
          <span className={styles.aiToggleIcon}><AiOrb size={18} /></span>
          <span className={styles.aiToggleLabel}>AI Compliance Assistant</span>
        </button>

        <button className={styles.iconBtn} title="Compliance Calendar" aria-label="Compliance Calendar"
          onClick={() => navigate('/dashboard/calendar')}>
          <Icon name="calendar" size={16} />
        </button>

        <NotificationBell />

        <div className={styles.userMenu}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{displayName}</p>
            <p className={styles.userRole}>{role}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
