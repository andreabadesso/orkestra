/**
 * Admin Groups Page - Mission Control
 *
 * Group management interface for administrators
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/toast';
import { trpc } from '@/lib/trpc';
import { UsersRound, Search, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { CreateGroupModal } from '@/components/groups/create-group-modal';
import { EditGroupModal } from '@/components/groups/edit-group-modal';
import { ViewMembersModal } from '@/components/groups/view-members-modal';

/**
 * Admin Groups Page Component
 */
export default function AdminGroupsPage() {
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewMembersModalOpen, setViewMembersModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const { data, isLoading, refetch } = trpc.adminOperations.listGroups.useQuery({
    filter: search ? { search } : undefined,
    pagination: { skip: 0, take: 100 },
  });

  const deleteGroup = trpc.adminOperations.deleteGroup.useMutation({
    onSuccess: () => {
      useToast().success('Group deleted successfully');
      refetch();
    },
    onError: (error) => {
      useToast().error(error.message);
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

  const groups = data?.items || [];
  const totalCount = data?.total || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
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
          <CardTitle className="font-serif">Groups ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-control-cyan animate-spin" />
            </div>
          ) : groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group: any) => (
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
                          {group.memberCount || 0}
                        </Badge>
                      </div>

                      {/* Sample Members Preview */}
                      {group.members && group.members.length > 0 && (
                        <div className="flex -space-x-2">
                          {(group.members || []).slice(0, 3).map((member: any) => (
                            <div
                              key={member.id}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-control-emerald to-control-cyan flex items-center justify-center text-xs font-bold border-2 border-control-bg"
                              title={member.user?.name}
                            >
                              {member.user?.name?.charAt(0).toUpperCase() || '?'}
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
