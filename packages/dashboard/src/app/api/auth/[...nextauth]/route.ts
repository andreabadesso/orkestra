/**
 * NextAuth API Route Handler
 *
 * Handles all NextAuth.js authentication requests.
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
