import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/providers/trpc';
import { Stethoscope, LogIn, Shield, Loader2, Users, UserCheck, Syringe, TrendingUp, Megaphone } from 'lucide-react';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const ROLE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  admin: { icon: Shield, color: 'text-red-400', label: 'Administrator' },
  manager: { icon: TrendingUp, color: 'text-blue-400', label: 'Manager' },
  sales: { icon: UserCheck, color: 'text-emerald-400', label: 'Sales' },
  marketing: { icon: Megaphone, color: 'text-purple-400', label: 'Marketing' },
  surgical_assistant: { icon: Syringe, color: 'text-amber-400', label: 'Surgical Assistant' },
  viewer: { icon: Users, color: 'text-zinc-400', label: 'Viewer' },
};

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [seedResult, setSeedResult] = useState<any>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.success && data.token) {
        localStorage.setItem('crm_token', data.token);
        onLogin(data.token, data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    },
    onError: (err) => setError(err.message),
  });

  const seedMutation = trpc.auth.seedAdmin.useMutation({
    onSuccess: (data) => {
      setSeedResult(data);
      if (data.success && data.credentials) {
        setUsername(data.credentials[0].username);
        setPassword(data.credentials[0].password);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Enter username and password'); return; }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a0f]">
      <div className="w-full max-w-md p-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AGILE</h1>
          <p className="text-sm text-zinc-500">Master CRM</p>
        </div>

        {/* Login Form */}
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs text-zinc-400">Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (e.g. admin)"
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {loginMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                {loginMutation.isPending ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            {/* Default credentials hint */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-zinc-500 mb-2">Default credentials (if not seeded yet):</p>
              <div className="flex flex-wrap gap-1">
                {['admin', 'sales1', 'marketing1', 'surgical1', 'manager1'].map((u) => (
                  <Badge key={u} variant="outline" className="text-[9px] bg-white/[0.02] text-zinc-400 border-white/10 cursor-pointer hover:bg-white/5" onClick={() => { setUsername(u); setPassword('Agile1'); }}>
                    {u} / Agile1
                  </Badge>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-[10px] text-zinc-500 hover:text-zinc-300"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? 'Creating...' : 'Click to create default users'}
              </Button>
              {seedResult?.success && seedResult.credentials && (
                <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400 font-medium mb-1">Users created! Use any:</p>
                  {seedResult.credentials.map((c: any) => (
                    <div key={c.username} className="flex items-center gap-2 text-[10px]">
                      <span className="text-zinc-300">{c.username}</span>
                      <span className="text-zinc-500">/</span>
                      <span className="text-zinc-300">{c.password}</span>
                      <Badge className={`text-[8px] ${ROLE_CONFIG[c.role]?.color || ''}`}>{c.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Info */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {Object.entries(ROLE_CONFIG).map(([role, config]) => {
            const Icon = config.icon;
            return (
              <div key={role} className="text-center p-2 rounded-lg bg-white/[0.02]">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${config.color}`} />
                <p className="text-[9px] text-zinc-500">{config.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
