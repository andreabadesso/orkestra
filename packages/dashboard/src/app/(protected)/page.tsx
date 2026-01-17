/**
 * Dashboard Home Page
 *
 * The main landing page for authenticated users.
 * Shows an overview of pending tasks.
 */

'use client';

import { useUser } from '@/hooks/use-user';

/**
 * Dashboard home page component
 */
export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div>
      <h1 style={styles.title}>Welcome back, {user?.name || 'User'}</h1>
      <p style={styles.subtitle}>
        Here are your pending tasks that need attention.
      </p>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>0</div>
          <div style={styles.statLabel}>Pending Tasks</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>0</div>
          <div style={styles.statLabel}>In Progress</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>0</div>
          <div style={styles.statLabel}>Completed Today</div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Tasks</h2>
        <div style={styles.emptyState}>
          <p>No tasks yet. Tasks will appear here when workflows require human input.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline styles
 */
const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  subtitle: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: '0.5rem',
    marginBottom: '2rem',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#4f46e5',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 1rem 0',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#6b7280',
  },
};
