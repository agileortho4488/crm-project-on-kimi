import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/providers/trpc';
import {
  Shield, Users, UserPlus, Loader2,
  TrendingUp, UserCheck, Megaphone, Syringe, Eye
} from 'lucide-react';

const ROLE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  admin: { icon: Shield, color: 'text-red-400', label: 'Administrator' },
  manager: { icon: TrendingUp, color: 'text-blue-400', label: 'Manager' },
  sales: { icon: UserCheck, color: 'text-emerald-400', label: 'Sales' },
  marketing: { icon: Megaphone, color: 'text-purple-400', label: 'Marketing' },
  surgical_assistant: { icon: Syringe, color: 'text-amber-400', label: 'Surgical Assistant' },
  viewer: { icon: Eye, color: 'text-zinc-400', label: 'Viewer' },
};

interface AdminPanelProps {
  token: string;
}

export function AdminPanel({ token }: AdminPanelProps) {
  const [newUser, setNewUser] = useState({
    username: '', password: '', name: '', role: 'sales' as "admin" | "manager" | "sales" | "marketing" | "surgical_assistant" | "viewer",
    division: '', district: '', phone: '', email: '',
  });
  const [message, setMessage] = useState('');

  const { data: usersData, refetch } = trpc.auth.listUsers.useQuery({ adminToken: token });
  const createMutation = trpc.auth.createUser.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage(`User ${newUser.username} created!`);
        setNewUser({ username: '', password: '', name: '', role: 'sales', division: '', district: '', phone: '', email: '' });
        refetch();
      } else {
        setMessage(data.error || 'Failed to create user');
      }
    },
  });
  const toggleMutation = trpc.auth.toggleUser.useMutation({ onSuccess: () => refetch() });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!newUser.username || !newUser.password || !newUser.name) {
      setMessage('Username, password, and name are required');
      return;
    }
    createMutation.mutate({ adminToken: token, ...newUser });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-zinc-500">Manage team members and access control</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-white">{usersData?.users?.length || 0}</p>
            <p className="text-[10px] text-zinc-500">Total Users</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-emerald-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {usersData?.users?.filter((u: any) => u.isActive).length || 0}
            </p>
            <p className="text-[10px] text-zinc-500">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-red-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">
              {usersData?.users?.filter((u: any) => !u.isActive).length || 0}
            </p>
            <p className="text-[10px] text-zinc-500">Inactive</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {new Set(usersData?.users?.map((u: any) => u.role)).size || 0}
            </p>
            <p className="text-[10px] text-zinc-500">Roles</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Create User Form */}
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Create New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500">Username *</Label>
                  <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="e.g. sales1" className="mt-1 bg-white/5 border-white/10 text-white text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Password *</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="e.g. Agile1" className="mt-1 bg-white/5 border-white/10 text-white text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Full Name *</Label>
                <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="e.g. Ramesh Kumar" className="mt-1 bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Role</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as any })}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                      <SelectItem key={role} value={role}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500">Division (optional)</Label>
                  <Input value={newUser.division} onChange={(e) => setNewUser({ ...newUser, division: e.target.value })} placeholder="e.g. gynecology" className="mt-1 bg-white/5 border-white/10 text-white text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">District (optional)</Label>
                  <Input value={newUser.district} onChange={(e) => setNewUser({ ...newUser, district: e.target.value })} placeholder="e.g. Hyderabad" className="mt-1 bg-white/5 border-white/10 text-white text-sm" />
                </div>
              </div>
              {message && (
                <div className={`p-2 rounded text-xs ${message.includes('created') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {message}
                </div>
              )}
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User List */}
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {usersData?.users?.length === 0 && (
                <p className="text-center text-sm text-zinc-600 py-8">No users found</p>
              )}
              {usersData?.users?.map((u: any) => {
                const config = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
                const Icon = config.icon;
                return (
                  <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg ${u.isActive ? 'bg-white/[0.02]' : 'bg-red-500/5 opacity-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${config.color.replace('text-', 'bg-').replace('400', '500/20').replace('500', '400')}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">{u.name}</p>
                        <p className="text-[10px] text-zinc-500">{u.username} • <span className={config.color}>{config.label}</span></p>
                        {u.lastLogin && <p className="text-[9px] text-zinc-600">Last login: {new Date(u.lastLogin).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.isActive ? (
                        <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400">Active</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-red-500/10 text-red-400">Inactive</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] border-white/10"
                        onClick={() => toggleMutation.mutate({ adminToken: token, userId: u.id, isActive: !u.isActive })}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
