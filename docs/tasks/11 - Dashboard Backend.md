# Task 11: Dashboard Backend (NextAuth + API Integration)

## Overview

Set up authentication and API integration for the Dashboard using NextAuth.js.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟡 **High** - Required for Dashboard functionality

## Estimated Effort

4-6 hours

## Description

Configure NextAuth.js for dashboard authentication, set up tRPC client integration, and handle session management.

## Requirements

### Authentication Setup

```typescript
// packages/dashboard/src/lib/auth.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { type NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate against Orkestra API
        const response = await fetch(`${process.env.ORKESTRA_API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) return null;

        const user = await response.json();
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          accessToken: user.accessToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as string;
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

### Type Extensions

```typescript
// packages/dashboard/src/types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface User {
    tenantId: string;
    role: string;
    accessToken: string;
  }

  interface Session {
    user: User;
    accessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId: string;
    role: string;
    accessToken: string;
  }
}
```

### tRPC Client Setup

```typescript
// packages/dashboard/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@orkestra/api';
import { getSession } from 'next-auth/react';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
        async headers() {
          const session = await getSession();
          return {
            authorization: session?.accessToken
              ? `Bearer ${session.accessToken}`
              : '',
          };
        },
      }),
    ],
  });
}
```

### Provider Setup

```typescript
// packages/dashboard/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, getTRPCClient } from '@/lib/trpc';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const [trpcClient] = useState(() => getTRPCClient());

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
```

### Middleware (Route Protection)

```typescript
// packages/dashboard/src/middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const isLoginPage = nextUrl.pathname === '/login';
  const isAdminRoute = nextUrl.pathname.startsWith('/admin');

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Redirect to tasks if already logged in and trying to access login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/tasks', nextUrl));
  }

  // Check admin routes
  if (isAdminRoute && session?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/tasks', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Login Page

```typescript
// packages/dashboard/src/app/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/tasks';
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setIsLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Orkestra</CardTitle>
          <p className="text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                name="email"
                type="email"
                placeholder="Email"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Input
                name="password"
                type="password"
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Layout with Session

```typescript
// packages/dashboard/src/app/layout.tsx
import { Providers } from './providers';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Protected Layout

```typescript
// packages/dashboard/src/app/(protected)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Auth Hook

```typescript
// packages/dashboard/src/hooks/use-user.ts
'use client';

import { useSession } from 'next-auth/react';

export function useUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isAdmin: session?.user?.role === 'admin',
  };
}
```

## Acceptance Criteria

- [ ] NextAuth configured with credentials provider
- [ ] JWT session strategy working
- [ ] Login page functional
- [ ] Protected routes redirect to login
- [ ] Admin routes check role
- [ ] tRPC client configured with auth headers
- [ ] Session includes tenant and role info
- [ ] Logout functionality works
- [ ] Session refresh/expiry handled
- [ ] Environment variables documented

## Dependencies

- [[01 - Initialize Monorepo]]
- [[09 - REST API]]

## Blocked By

- [[09 - REST API]] - Need auth endpoint

## Blocks

- [[10 - Dashboard UI]]

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "next-auth": "^5.0.0-beta",
    "@auth/core": "^0.25.0"
  }
}
```

### Environment Variables

```env
# .env.local
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-here
ORKESTRA_API_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### API Auth Endpoint

The API needs an auth endpoint:

```typescript
// In @orkestra/api
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // Validate credentials
  // Return user with accessToken
});
```

## References

- [NextAuth.js v5](https://authjs.dev/)
- [tRPC with Next.js](https://trpc.io/docs/client/nextjs)

## Tags

#orkestra #task #dashboard #auth #nextauth
