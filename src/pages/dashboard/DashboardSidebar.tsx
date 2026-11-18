/**
 * src/pages/dashboard/DashboardSidebar.tsx — unchanged from original.
 * No Supabase changes needed here; navigation is pure UI.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './DashboardSidebar.module.css';

const logoSrc = '/regnix-mark.png';

interface NavSection { label: string; items: NavItem[]; }
interface NavItem {
  id: string; icon: JSX.Element; label: string;
  badge?: string; children?: { id: string; label: string }[];
}

const Icon = ({ d }: { d: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV: NavSection[] = [
  {
    label: '',
    items: [{
      id: 'dashboard',
      icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
      label: 'Dashboard',
    }],
  },
  {
    label: 'Compliance',
    items: [
      {
        id: 'compliance',
        icon: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
        label: 'Compliance',
        children: [
          { id: 'calendar',   label: 'Compliance Calendar'  },
          { id: 'generator',  label: 'Document Generator'   },
          { id: 'checker',    label: 'Applicability Checker'},

        ],
      },
      {
        id: 'audit',
        icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
        label: 'Audit',
        children: [
          { id: 'planner',   label: 'Audit Planner' },

        ],
      },
      
    ],
  },
  {
    label: 'Operations',
    items: [
      
      {
        id: 'documents',
        icon: <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" />,
        label: 'Documents',
      },
      {
        id: 'library',
        icon: <Icon d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21V5M9 8h6" />,
        label: 'E-Library',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        id: 'reports',
        icon: <Icon d="M18 20V10M12 20V4M6 20v-6" />,
        label: 'Analytics & Reports',
      },
      {
        id: 'tasks',
        icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
        label: 'Tasks & Workflow',
      },
      {
        id: 'notifications',
        icon: <Icon d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />,
        label: 'Notifications',
      },
    ],
  },
];

interface Props {
  collapsed:   boolean;
  onToggle:    () => void;
  activeView:  string;
  onNavigate:  (id: string) => void;
}

export function DashboardSidebar({ collapsed, onToggle, activeView, onNavigate }: Props) {
  const [expanded, setExpanded] = useState<string | null>('compliance');
  const { unreadCount } = useNotifications();
  // Live unread count on the Notifications item (replaces the hard-coded badge)
  const navSections = useMemo(() => NAV.map(sec => ({
    ...sec,
    items: sec.items.map(it => it.id === 'notifications' && unreadCount > 0
      ? { ...it, badge: String(unreadCount) } : it),
  })), [unreadCount]);
  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        <Link to="/" className={styles.logo} aria-label="Go to home">
          <span className={styles.logoMark}>
            <img src={logoSrc} alt="Regnix logo" className={styles.logoImage} />
          </span>
          {!collapsed && (
            <div className={styles.logoText}>
              <span className={styles.logoName}>Regnix</span>
              <span className={styles.logoBy}>by Lexvon</span>
            </div>
          )}
        </Link>
        <button type="button" className={styles.collapseBtn} onClick={onToggle}
          title="Toggle sidebar" aria-label="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className={styles.nav} aria-label="Sidebar navigation">
        {navSections.map(section => (
          <div key={section.label || 'root'} className={styles.navSection}>
            {section.label && !collapsed && (
              <div className={styles.sectionLabel}>{section.label}</div>
            )}
            {section.items.map(item => {
              const isExpanded = expanded === item.id;
              const isActive   = activeView === item.id;
              return (
                <div key={item.id} className={styles.navGroup}>
                  <button type="button"
                    className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
                    onClick={() => item.children ? toggle(item.id) : onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-expanded={item.children ? isExpanded : undefined}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className={styles.navLabel}>{item.label}</span>
                        {item.badge && <span className={styles.badge}>{item.badge}</span>}
                        {item.children && (
                          <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  {!collapsed && item.children && isExpanded && (
                    <div className={styles.subNav}>
                      {item.children.map(child => (
                        <button type="button" key={child.id}
                          className={`${styles.subNavItem} ${activeView === child.id ? styles.subNavActive : ''}`}
                          onClick={() => onNavigate(child.id)}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <button type="button"
          className={`${styles.navItem} ${activeView === 'settings' ? styles.navActive : ''}`}
          onClick={() => onNavigate('settings')}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className={styles.navIcon}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </span>
          {!collapsed && <span className={styles.navLabel}>Settings</span>}
        </button>
      </div>
    </aside>
  );
}