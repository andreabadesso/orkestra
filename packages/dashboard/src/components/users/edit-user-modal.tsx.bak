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
import { Checkbox } from '@/components/ui/checkbox';

export function EditUserModal({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'agent' as 'admin' | 'manager' | 'agent',
    status: 'active' as 'active' | 'inactive',
  });
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const { data: user } = trpc.userManagement.get.useQuery({ id: userId }, { enabled: isOpen });
  const { data: groupsData } = trpc.adminOperations.listGroups.useQuery(
    {
      filter: { isAssignable: true },
      pagination: { take: 100, skip: 0 },
    },
    { enabled: isOpen }
  );

  const updateUser = trpc.userManagement.update.useMutation({
    onSuccess: () => {
      toast.success('User updated successfully');
      onClose();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role as 'admin' | 'manager' | 'agent',
        status: user.status as 'active' | 'inactive',
      });
      setSelectedGroupIds(user.groups?.map((g: any) => g.id) || []);
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUser.mutateAsync({
      id: userId,
      ...formData,
      groupIds: selectedGroupIds,
    });
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id: string) => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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

          {groupsData?.items && groupsData.items.length > 0 && (
            <div className="space-y-2">
              <Label>Groups</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {groupsData.items.map((group: any) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-group-${group.id}`}
                      checked={selectedGroupIds.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <label htmlFor={`edit-group-${group.id}`} className="text-sm cursor-pointer">
                      {group.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

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
