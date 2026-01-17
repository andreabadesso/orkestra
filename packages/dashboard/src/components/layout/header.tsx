/**
 * Header Component
 *
 * Top header with user menu, notifications, and search.
 */

'use client';

import { signOut } from 'next-auth/react';
import { LogOut, Bell, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/hooks/use-user';

/**
 * Header component props
 */
interface HeaderProps {
  /** Page title to display */
  title?: string;
}

/**
 * Header component
 */
export function Header({ title }: HeaderProps) {
  const { user } = useUser();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      admin: 'Administrator',
      manager: 'Manager',
      agent: 'Agent',
      operator: 'Operator',
      viewer: 'Viewer',
    };
    return roleNames[role] || role;
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        {/* Title */}
        <div style={styles.titleSection}>
          {title && <h1 style={styles.title}>{title}</h1>}
        </div>

        {/* Right side */}
        <div style={styles.rightSection}>
          {/* Notifications */}
          <button style={styles.iconButton} aria-label="Notifications">
            <Bell size={20} />
            <span style={styles.notificationBadge}>3</span>
          </button>

          {/* User menu */}
          <div ref={menuRef} style={styles.userMenuContainer}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              style={styles.userButton}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              <div style={styles.avatar}>
                <User size={18} />
              </div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>
                  {user?.name || user?.email || 'User'}
                </span>
                <span style={styles.userRole}>
                  {user?.role ? getRoleDisplayName(user.role) : ''}
                </span>
              </div>
              <ChevronDown
                size={16}
                style={{
                  ...styles.chevron,
                  transform: isUserMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
            </button>

            {/* Dropdown menu */}
            {isUserMenuOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <div style={styles.dropdownUserInfo}>
                    <span style={styles.dropdownUserName}>
                      {user?.name || 'User'}
                    </span>
                    <span style={styles.dropdownUserEmail}>{user?.email}</span>
                    <span style={styles.dropdownTenant}>
                      Tenant: {user?.tenantId}
                    </span>
                  </div>
                </div>
                <div style={styles.dropdownDivider} />
                <button onClick={handleSignOut} style={styles.dropdownItem}>
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 1.5rem',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  headerContent: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#111827',
    margin: 0,
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
    position: 'relative' as const,
    transition: 'background-color 0.15s',
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: '6px',
    right: '6px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '0.625rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMenuContainer: {
    position: 'relative' as const,
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    marginRight: '0.25rem',
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#111827',
    lineHeight: '1.2',
  },
  userRole: {
    fontSize: '0.75rem',
    color: '#6b7280',
    lineHeight: '1.2',
  },
  chevron: {
    color: '#6b7280',
    transition: 'transform 0.2s',
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    width: '240px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    zIndex: 50,
  },
  dropdownHeader: {
    padding: '1rem',
  },
  dropdownUserInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  dropdownUserName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
  },
  dropdownUserEmail: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  dropdownTenant: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#e5e7eb',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.75rem 1rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#4b5563',
    textAlign: 'left' as const,
    transition: 'background-color 0.15s',
  },
};

export default Header;
