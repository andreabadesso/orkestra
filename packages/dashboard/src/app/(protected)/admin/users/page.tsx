/**
 * Admin Users Page - Mission Control
 *
 * User management interface with CRUD operations
 */

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
} from 'lucide-react';
import { CreateUserModal } from '@/components/users/create-user-modal';
import { EditUserModal } from '@/components/users/edit-user-modal';

/**
 * Admin Users Page Component
 */
export default function AdminUsersPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.userManagement.list.useQuery({
    search: search || undefined,
    role: roleFilter !== 'all' ? (roleFilter as 'admin' | 'manager' | 'agent') : undefined,
    status: statusFilter !== 'all' ? (statusFilter as 'active' | 'inactive') : undefined,
    page,
  });

  const deleteUser = trpc.userManagement.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted successfully');
      refetch();
    },
    onError: (error: { message: string }) => {
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

  const handleEdit = (userId: string) => {
    setEditUserId(userId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="section-heading">User Management</h1>
          <p className="mono-data">TEAM MEMBER ADMINISTRATION</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit user"
                      onClick={() => handleEdit(user.id)}
                    >
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

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          refetch();
        }}
      />

      {/* Edit User Modal */}
      {editUserId && (
        <EditUserModal
          isOpen={!!editUserId}
          onClose={() => {
            setEditUserId(null);
            refetch();
          }}
          userId={editUserId}
        />
      )}
    </div>
  );
}
