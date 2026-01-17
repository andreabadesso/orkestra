/**
 * Tenant Settings Router
 *
 * tRPC router for tenant settings operations (branding, notifications, task behavior).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '../index.js';

/**
 * Color hex regex for validation
 */
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/**
 * Tenant settings router
 */
export const tenantSettingsRouter = router({
  // =========================================================================
  // Get settings
  // =========================================================================

  /**
   * Get tenant settings
   */
  get: authedProcedure.query(async ({ ctx }) => {
    const { repositories, requestContext } = ctx;

    if (!repositories || !requestContext) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database not configured',
      });
    }

    const settings = await repositories.tenantSettings.findByTenantId(requestContext.tenantId);

    return (
      settings || {
        brandName: 'Orkestra',
        brandLogo: null,
        primaryColor: '#06b6d4',
        notificationEmail: null,
        taskAutoAssignment: false,
        defaultSLADuration: '24h',
      }
    );
  }),

  // =========================================================================
  // Update settings
  // =========================================================================

  /**
   * Update tenant settings
   */
  update: authedProcedure
    .input(
      z.object({
        brandName: z.string().min(1).max(100).optional(),
        brandLogo: z.string().url().nullable().optional(),
        primaryColor: z.string().regex(hexColorRegex).optional(),
        notificationEmail: z.string().email().nullable().optional(),
        taskAutoAssignment: z.boolean().optional(),
        defaultSLADuration: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not configured',
        });
      }

      const existing = await repositories.tenantSettings.findByTenantId(requestContext.tenantId);

      if (existing) {
        return await repositories.tenantSettings.update(requestContext.tenantId, input);
      } else {
        return await repositories.tenantSettings.create({
          tenantId: requestContext.tenantId,
          brandName: input.brandName ?? undefined,
          brandLogo: input.brandLogo ?? undefined,
          primaryColor: input.primaryColor ?? undefined,
          notificationEmail: input.notificationEmail ?? undefined,
          taskAutoAssignment: input.taskAutoAssignment,
          defaultSLADuration: input.defaultSLADuration,
        });
      }
    }),

  // =========================================================================
  // Test notifications
  // =========================================================================

  /**
   * Test notification settings
   */
  testNotification: authedProcedure
    .input(
      z.object({
        type: z.enum(['email', 'slack']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not configured',
        });
      }

      const settings = await repositories.tenantSettings.findByTenantId(requestContext.tenantId);

      if (!settings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Settings not configured',
        });
      }

      // Send test notification
      if (input.type === 'email' && settings.notificationEmail) {
        // Integrate with notification service
        // await sendTestEmail(settings.notificationEmail, ctx.tenantId);
        console.log(`[Test Notification] Email would be sent to: ${settings.notificationEmail}`);
      }

      return { success: true };
    }),
});

export type TenantSettingsRouter = typeof tenantSettingsRouter;
