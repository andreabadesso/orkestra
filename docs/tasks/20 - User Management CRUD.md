# Task 20: User Management (CRUD)

## Overview

Implement complete CRUD (Create, Read, Update, Delete) functionality for user management in the Orkestra Dashboard. Currently, the Users page displays hardcoded data and needs to connect to the actual API.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟡 **High**

## Estimated Effort

6-8 hours

## Dependencies

- Task 09: REST API (need user management tRPC procedures)
- Task 10: Dashboard UI (existing UI structure)

## Requirements

### 1. Backend: Add User Management tRPC Procedures

Add to `packages/api/src/routers/user.ts`:

```typescript
// Add to existing router (if it exists) or create new router
export const userRouter = router({
  // List users with pagination and filtering
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(['admin', 'manager', 'agent']).optional(),
        status: z.enum(['active', 'inactive']).optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.limit;

      const users = await prisma.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
          ...(input.role && { role: input.role }),
          ...(input.status && { status: input.status }),
        },
        include: {
          groups: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: offset,
      });

      const total = await prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
          ...(input.role && { role: input.role }),
          ...(input.status && { status: input.status }),
        },
      });

      return {
        users,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Get single user by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const user = await prisma.user.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
        },
        include: {
          groups: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }),

  // Create new user
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        role: z.enum(['admin', 'manager', 'agent']),
        groupIds: z.array(z.string()).optional(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if email already exists
      const existing = await prisma.user.findFirst({
        where: {
          email: input.email,
          tenantId: ctx.tenantId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          email: input.email,
          role: input.role,
          password: hashedPassword,
          status: 'active',
        },
      });

      // Assign to groups if provided
      if (input.groupIds && input.groupIds.length > 0) {
        await prisma.userGroup.createMany({
          data: input.groupIds.map((groupId) => ({
            userId: user.id,
            groupId,
          })),
        });
      }

      return user;
    }),

  // Update user
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(100).optional(),
        email: z.string().email().optional(),
        role: z.enum(['admin', 'manager', 'agent']).optional(),
        groupIds: z.array(z.string()).optional(),
        status: z.enum(['active', 'inactive']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, groupIds, ...updateData } = input;

      // Check if user exists and belongs to tenant
      const existing = await prisma.user.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Prevent self-deactivation
      if (id === ctx.user.id && updateData.status === 'inactive') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot deactivate yourself',
        });
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Update group assignments if provided
      if (groupIds !== undefined) {
        // Remove existing group memberships
        await prisma.userGroup.deleteMany({
          where: { userId: id },
        });

        // Add new group memberships
        if (groupIds.length > 0) {
          await prisma.userGroup.createMany({
            data: groupIds.map((groupId) => ({
              userId: id,
              groupId,
            })),
          });
        }
      }

      return user;
    }),

  // Delete user
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user exists
      const user = await prisma.user.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Prevent self-deletion
      if (user.id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete yourself',
        });
      }

      // Delete user (cascade will remove group memberships)
      await prisma.user.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
```

### 2. Frontend: Update Users Page

Update `packages/dashboard/src/app/(protected)/admin/users/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.user.list.useQuery({
    search: search || undefined,
    role: roleFilter !== 'all' ? (roleFilter as 'admin' | 'manager' | 'agent') : undefined,
    page,
  });

  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success('User deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) {
      return;
    }
    try {
      await deleteUser.mutateAsync({ id: userId });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="section-heading">User Management</h1>
          <p className="mono-data">TEAM MEMBER ADMINISTRATION</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          <span>Add User</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-control-border-bright">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="agent">Agents</option>
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-control-border-bright">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif">Users ({data?.total || 0})</CardTitle>
            {data && data.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="mono-data">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-control-cyan animate-spin" />
            </div>
          ) : data?.users && data.users.length > 0 ? (
            <div className="space-y-3">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 pb-3 border-b border-control-border font-mono text-xs text-muted-foreground">
                <div>USER</div>
                <div>ROLE</div>
                <div>GROUPS</div>
                <div>STATUS</div>
                <div className="text-right">ACTIONS</div>
              </div>

              {/* User Rows */}
              {data.users.map((user) => (
                <div
                  key={user.id}
                  className="grid grid-cols-5 gap-4 py-3 border-b border-control-border hover:bg-control-panel/50 transition-colors items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-control-cyan to-control-amber flex items-center justify-center text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-sm truncate">{user.name}</p>
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Badge
                      variant={user.role === 'admin' ? 'default' : 'outline'}
                      className="font-mono"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {user.role.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.groups?.map((group) => (
                      <Badge key={group.id} variant="outline" className="font-mono text-[10px]">
                        {group.name}
                      </Badge>
                    ))}
                    {(!user.groups || user.groups.length === 0) && (
                      <span className="text-muted-foreground text-sm">No groups</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`status-led ${user.status === 'active' ? 'status-active' : 'status-inactive'}`}
                    ></span>
                    <span
                      className={`mono-data text-xs ${user.status === 'active' ? 'text-control-emerald' : 'text-muted-foreground'}`}
                    >
                      {user.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" title="Edit user">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete user"
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deleteUser.isPending}
                    >
                      {deleteUser.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="mono-data text-muted-foreground">NO USERS FOUND</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. Add Create User Modal

Create `packages/dashboard/src/components/users/create-user-modal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'agent' as 'admin' | 'manager' | 'agent',
    password: '',
    groupIds: [] as string[],
  });

  const { data: groups } = trpc.group.list.useQuery();
  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      toast.success('User created successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser.mutateAsync(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as any }))}
            >
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Add Edit User Modal

Create `packages/dashboard/src/components/users/edit-user-modal.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function EditUserModal({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'agent' as 'admin' | 'manager' | 'agent',
    groupIds: [] as string[],
    status: 'active' as 'active' | 'inactive',
  });

  const { data: user } = trpc.user.get.useQuery({ id: userId }, { enabled: isOpen });
  const { data: groups } = trpc.group.list.useQuery();

  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success('User updated successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role as 'admin' | 'manager' | 'agent',
        groupIds: user.groups?.map((g: any) => g.id) || [],
        status: user.status as 'active' | 'inactive',
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUser.mutateAsync({ id: userId, ...formData });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as any }))}
            >
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## Acceptance Criteria

- [ ] `user.list` tRPC procedure returns paginated users with search/filter
- [ ] `user.get` tRPC procedure returns single user with groups
- [ ] `user.create` tRPC procedure creates user with password hashing
- [ ] `user.update` tRPC procedure updates user fields and group assignments
- [ ] `user.delete` tRPC procedure deletes user with safety checks
- [ ] Users page displays real data from API
- [ ] Search by name or email works
- [ ] Filter by role works (admin, manager, agent)
- [ ] Filter by status works (active, inactive)
- [ ] Pagination controls work (Previous, Next, page numbers)
- [ ] Add User button opens create modal
- [ ] Create user modal submits successfully
- [ ] Edit button opens edit modal with user data
- [ ] Edit user modal updates user successfully
- [ ] Delete button confirms before deletion
- [ ] Delete mutation prevents self-deletion
- [ ] Update mutation prevents self-deactivation
- [ ] Group memberships displayed for each user
- [ ] Loading states shown during mutations
- [ ] Toast notifications shown for success/error
- [ ] Error handling for duplicate email
- [ ] Error handling for user not found
- [ ] Table shows user groups as badges
- [ ] User avatar shows initials
- [ ] Status LED shows active/inactive state

## Dependencies

- Task 09: REST API (tRPC infrastructure)
- Task 10: Dashboard UI (existing page structure)
- Task 23: Toast Notifications (for error handling)

## Technical Notes

### Password Hashing

Use `bcrypt` for password hashing. Add to `packages/api/package.json`:

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1"
  }
}
```

### Role-Based Access

Only admins and managers should be able to:

- Create users
- Update users
- Delete users

Add middleware check in tRPC router.

### Group Assignments

Users can belong to multiple groups. Use a junction table (UserGroup) in the schema.

## References

- [Prisma Pagination](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)
- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)
- [tRPC Mutation Handling](https://trpc.io/docs/react/react/useMutation)

## Tags

#orkestra #task-20 #admin #user-management #crud #dashboard
