/**
 * Root Layout
 *
 * The main layout component for the Next.js application.
 * Wraps all pages with the necessary providers.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

/**
 * Application metadata
 */
export const metadata: Metadata = {
  title: 'Orkestra Dashboard',
  description: 'Human task management UI for Orkestra',
};

/**
 * Root layout props
 */
interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Root layout component
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
