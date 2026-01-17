/**
 * Protected Layout
 *
 * Layout wrapper for authenticated routes.
 * Provides common UI elements and ensures users are authenticated.
 */

'use client';

import { type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { useUser } from '@/hooks/use-user';

/**
 * Props for the protected layout
 */
interface ProtectedLayoutProps {
  children: ReactNode;
}

/**
 * Protected layout component
 *
 * Wraps all authenticated routes with:
 * - Navigation header
 * - User info display
 * - Sign out functionality
 */
export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, isLoading, isAdmin } = useUser();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>Loading...</div>
      </div>
    );
  }

  // If not authenticated, the middleware will redirect
  // This is just a fallback
  if (!user) {
    return null;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div style={styles.layout}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <span style={styles.logoText}>Orkestra</span>
          </div>

          <nav style={styles.nav}>
            <a href="/" style={styles.navLink}>
              Tasks
            </a>
            <a href="/workflows" style={styles.navLink}>
              Workflows
            </a>
            {isAdmin && (
              <a href="/admin" style={styles.navLink}>
                Admin
              </a>
            )}
          </nav>

          <div style={styles.userSection}>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user.name || user.email}</span>
              <span style={styles.userRole}>{user.role}</span>
            </div>
            <button onClick={handleSignOut} style={styles.signOutButton}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>{children}</main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <span>Tenant: {user.tenantId}</span>
          <span>Orkestra Dashboard</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Inline styles for the protected layout
 */
const styles: Record<string, React.CSSProperties> = {
  layout: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    fontSize: '1.25rem',
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 1.5rem',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
  },
  headerContent: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#4f46e5',
  },
  nav: {
    display: 'flex',
    gap: '1.5rem',
  },
  navLink: {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    fontSize: '0.875rem',
  },
  userName: {
    fontWeight: 500,
    color: '#111827',
  },
  userRole: {
    color: '#6b7280',
    fontSize: '0.75rem',
    textTransform: 'capitalize' as const,
  },
  signOutButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  },
  main: {
    flex: 1,
    padding: '2rem 1.5rem',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    padding: '1rem 1.5rem',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
};
