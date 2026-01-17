# Task 21: Group Management

## Overview

Implement group management functionality in the Orkestra Dashboard. Groups are used for task assignment and user organization. Currently, no Groups page exists.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟡 **High**

## Estimated Effort

4-6 hours

## Dependencies

- Task 09: REST API (need group management tRPC procedures)
- Task 10: Dashboard UI (existing layout structure)

## Requirements

### 1. Backend: Add Group Management tRPC Procedures

Add to `packages/api/src/routers/group.ts`:

```typescript
export const groupRouter = router({
  // List all groups for tenant
  list: protectedProcedure.query(async ({ ctx }) => {
    const groups = await prisma.group.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { userId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map((group) => ({
      ...group,
      memberCount: group._count.userId,
    }));
  }),

  // Get single group by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
        },
        include: {
          members: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      return group;
    }),

  // Create new group
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if group name already exists
      const existing = await prisma.group.findFirst({
        where: {
          name: input.name,
          tenantId: ctx.tenantId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Group with this name already exists',
        });
      }

      const group = await prisma.group.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description,
        },
      });

      return group;
    }),

  // Update group
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(100).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;

      // Check if group exists
      const existing = await prisma.group.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check for duplicate name
      if (updateData.name) {
        const duplicate = await prisma.group.findFirst({
          where: {
            name: updateData.name,
            tenantId: ctx.tenantId,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Group with this name already exists',
          });
        }
      }

      const group = await prisma.group.update({
        where: { id },
        data: updateData,
      });

      return group;
    }),

  // Delete group
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if group exists
      const group = await prisma.group.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check if group has active tasks
      const activeTasks = await prisma.task.count({
        where: {
          assignedGroupId: input.id,
          status: { in: ['pending', 'in_progress', 'assigned'] },
        },
      });

      if (activeTasks > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete group with active tasks',
        });
      }

      // Delete group (cascade will remove member associations)
      await prisma.group.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Add member to group
  addMember: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if group exists
      const group = await prisma.group.findFirst({
        where: {
          id: input.groupId,
          tenantId: ctx.tenantId,
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check if user exists
      const user = await prisma.user.findFirst({
        where: {
          id: input.userId,
          tenantId: ctx.tenantId,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if already a member
      const existing = await prisma.userGroup.findFirst({
        where: {
          userId: input.userId,
          groupId: input.groupId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User is already a member of this group',
        });
      }

      // Add member
      await prisma.userGroup.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
        },
      });

      return { success: true };
    }),

  // Remove member from group
  removeMember: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Remove membership
      await prisma.userGroup.deleteMany({
        where: {
          userId: input.userId,
          groupId: input.groupId,
        },
      });

      return { success: true };
    }),
});
```

### 2. Frontend: Create Groups Page

Create `packages/dashboard/src/app/(protected)/admin/groups/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import {
  UsersRound,
  Search,
  Plus,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Loader2,
  X,
  Mail,
  Shield,
} from 'lucide-react';

export default function AdminGroupsPage() {
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [viewMembersModalOpen, setViewMembersModalOpen] = useState(false);

  const { data: groups, isLoading, refetch } = trpc.group.list.useQuery();

  const deleteGroup = trpc.group.delete.useMutation({
    onSuccess: () => {
      toast.success('Group deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteGroup.mutateAsync({ id: groupId });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="section-heading">Group Management</h1>
          <p className="mono-data">TEAM GROUPS ADMINISTRATION</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Create Group</span>
        </Button>
      </div>

      {/* Search */}
      <Card className="border-control-border-bright">
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Groups Grid */}
      <Card className="border-control-border-bright">
        <CardHeader>
          <CardTitle className="font-serif">Groups ({groups?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-control-cyan animate-spin" />
            </div>
          ) : groups && groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups
                .filter(
                  (group) => !search || group.name.toLowerCase().includes(search.toLowerCase())
                )
                .map((group) => (
                  <Card
                    key={group.id}
                    className="border-control-border hover:border-control-cyan/50 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-serif text-lg font-semibold mb-1">{group.name}</h3>
                          {group.description && (
                            <p className="text-sm text-muted-foreground">{group.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedGroup(group);
                              setViewMembersModalOpen(true);
                            }}
                            title="View members"
                          >
                            <UsersRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedGroup(group);
                              setEditModalOpen(true);
                            }}
                            title="Edit group"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(group.id, group.name)}
                            title="Delete group"
                            disabled={deleteGroup.isPending}
                          >
                            {deleteGroup.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="mono-data text-muted-foreground text-sm">MEMBERS</span>
                          <Badge variant="outline" className="font-mono">
                            {group.memberCount}
                          </Badge>
                        </div>

                        {/* Sample Members Preview */}
                        {group.members && group.members.length > 0 && (
                          <div className="flex -space-x-2">
                            {group.members.slice(0, 3).map((member: any) => (
                              <div
                                key={member.id}
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-control-emerald to-control-cyan flex items-center justify-center text-xs font-bold border-2 border-control-bg"
                                title={member.name}
                              >
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {group.members.length > 3 && (
                              <div className="w-8 h-8 rounded-full bg-control-bg flex items-center justify-center text-xs font-bold border-2 border-control-border">
                                +{group.members.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UsersRound className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="mono-data text-muted-foreground">NO GROUPS FOUND</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create groups to organize your team for task assignment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Edit Group Modal */}
      {selectedGroup && (
        <EditGroupModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          group={selectedGroup}
          onSuccess={() => refetch()}
        />
      )}

      {/* View Members Modal */}
      {selectedGroup && (
        <ViewMembersModal
          isOpen={viewMembersModalOpen}
          onClose={() => setViewMembersModalOpen(false)}
          group={selectedGroup}
        />
      )}
    </div>
  );
}
```

### 3. Create Group Modals

Create `packages/dashboard/src/components/groups/create-group-modal.tsx`:

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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function CreateGroupModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const createGroup = trpc.group.create.useMutation({
    onSuccess: () => {
      toast.success('Group created successfully');
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createGroup.mutateAsync(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the group's purpose..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `packages/dashboard/src/components/groups/edit-group-modal.tsx`:

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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

export function EditGroupModal({
  isOpen,
  onClose,
  group,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  group: any;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const updateGroup = trpc.group.update.useMutation({
    onSuccess: () => {
      toast.success('Group updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
      });
    }
  }, [group, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGroup.mutateAsync({ id: group.id, ...formData });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the group's purpose..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateGroup.isPending}>
              {updateGroup.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Create `packages/dashboard/src/components/groups/view-members-modal.tsx`:

```tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { X, Mail, Shield, Loader2 } from 'lucide-react';

export function ViewMembersModal({
  isOpen,
  onClose,
  group,
}: {
  isOpen: boolean;
  onClose: () => void;
  group: any;
}) {
  const [search, setSearch] = useState('');
  const { data: availableUsers } = trpc.user.list.useQuery({
    page: 1,
    limit: 100,
  });

  const groupMembers = group.members || [];

  const filteredMembers = groupMembers.filter(
    (member: any) =>
      !search ||
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailableUsers = (availableUsers?.users || []).filter(
    (user: any) => !groupMembers.some((m: any) => m.id === user.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Members of {group.name}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Members */}
          <div>
            <h3 className="font-mono text-sm text-muted-foreground mb-3">
              CURRENT MEMBERS ({groupMembers.length})
            </h3>
            {filteredMembers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredMembers.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-control-panel/50 border border-control-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-control-cyan to-control-amber flex items-center justify-center text-xs font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{member.name}</p>
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      <Shield className="w-3 h-3 mr-1" />
                      {member.role.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No members found</div>
            )}
          </div>

          {/* Add Members */}
          <div>
            <h3 className="font-mono text-sm text-muted-foreground mb-3">ADD MEMBERS</h3>
            <div className="relative mb-3">
              <Input
                placeholder="Search users to add..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filteredAvailableUsers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredAvailableUsers.slice(0, 10).map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-control-bg border border-control-border hover:border-control-cyan/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-control-emerald to-control-cyan flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{user.name}</p>
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No users available to add
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Acceptance Criteria

- [ ] `group.list` tRPC procedure returns all groups with member counts
- [ ] `group.get` tRPC procedure returns single group with members
- [ ] `group.create` tRPC procedure creates new group
- [ ] `group.update` tRPC procedure updates group name/description
- [ ] `group.delete` tRPC procedure deletes group with safety checks
- [ ] `group.addMember` tRPC procedure adds user to group
- [ ] `group.removeMember` tRPC procedure removes user from group
- [ ] Groups page displays all groups in a grid
- [ ] Each group card shows member count
- [ ] Each group card shows member avatars (up to 3)
- [ ] Search filters groups by name
- [ ] Create Group button opens create modal
- [ ] Create group modal creates group successfully
- [ ] Edit button opens edit modal with group data
- [ ] Edit group modal updates group successfully
- [ ] View Members button shows all group members
- [ ] View Members modal allows adding new members
- [ ] Delete button confirms before deletion
- [ ] Delete mutation prevents deleting groups with active tasks
- [ ] Member avatars show initials
- [ ] Member roles displayed as badges
- [ ] Loading states shown during mutations
- [ ] Toast notifications shown for success/error
- [ ] Error handling for duplicate group name
- [ ] Error handling for group not found
- [ ] Modal for adding members filters by search
- [ ] Members list shows user email and role

## Dependencies

- Task 09: REST API (tRPC infrastructure)
- Task 10: Dashboard UI (existing layout structure)
- Task 23: Toast Notifications (for error handling)

## Technical Notes

### Group-User Relationship

Use a many-to-many relationship between User and Group via a junction table (UserGroup).

### Cascade Deletion

When deleting a group, ensure all UserGroup records are deleted via cascade.

### Active Task Check

Prevent group deletion if there are active tasks assigned to that group.

## References

- [Prisma Many-to-Many Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations#many-to-many-relations)
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)

## Tags

#orkestra #task-21 #admin #group-management #dashboard
