/**
 * Sidebar Component
 *
 * Navigation sidebar for the dashboard.
 * Shows navigation links based on user role.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  History,
  Users,
  UsersRound,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useUser } from '@/hooks/use-user';

/**
 * Navigation item definition
 */
interface NavItem {
  /** Display label */
  label: string;
  /** Route path */
  href: string;
  /** Icon component */
  icon: React.ElementType;
  /** Whether this item requires admin access */
  adminOnly?: boolean;
  /** Whether this item requires manager access */
  managerOnly?: boolean;
}

/**
 * Navigation items configuration
 */
const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: Inbox,
  },
  {
    label: 'History',
    href: '/history',
    icon: History,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    managerOnly: true,
  },
  {
    label: 'Groups',
    href: '/admin/groups',
    icon: UsersRound,
    managerOnly: true,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    adminOnly: true,
  },
];

/**
 * Sidebar component
 */
export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, isManager } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter nav items based on user role
  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.managerOnly && !isManager) return false;
    return true;
  });

  return (
    <aside style={{
      ...styles.sidebar,
      width: isCollapsed ? '64px' : '240px',
    }}>
      {/* Logo */}
      <div style={styles.logoContainer}>
        {!isCollapsed && (
          <Link href="/" style={styles.logo}>
            Orkestra
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={styles.collapseButton}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={20} style={styles.navIcon} />
              {!isCollapsed && (
                <span style={styles.navLabel}>{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider for admin section */}
      {isManager && !isCollapsed && (
        <div style={styles.sectionDivider}>
          <span style={styles.sectionLabel}>Administration</span>
        </div>
      )}
    </aside>
  );
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    height: '100vh',
    position: 'sticky' as const,
    top: 0,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    minHeight: '64px',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#4f46e5',
    textDecoration: 'none',
  },
  collapseButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'background-color 0.15s',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '1rem 0.5rem',
    gap: '0.25rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '6px',
    color: '#4b5563',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'background-color 0.15s, color 0.15s',
  },
  navItemActive: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
  },
  navIcon: {
    flexShrink: 0,
  },
  navLabel: {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sectionDivider: {
    padding: '0.75rem 1rem',
    borderTop: '1px solid #e5e7eb',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
};

export default Sidebar;
