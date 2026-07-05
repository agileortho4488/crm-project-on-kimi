import { useState } from 'react';
import { Search, Bell, LogOut, Shield, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  title: string;
  user?: any;
  onLogout?: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-red-400 bg-red-500/20 border-red-500/30',
  manager: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  sales: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  marketing: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  surgical_assistant: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  viewer: 'text-zinc-400 bg-zinc-500/20 border-zinc-500/30',
};

export function Header({ searchQuery, onSearchChange, title, user, onLogout }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const roleColor = ROLE_COLORS[user?.role || 'viewer'] || ROLE_COLORS.viewer;

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-[#111118]/80 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">MASTER CRM</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="w-72 pl-9 bg-white/5 border-white/10 text-zinc-300 placeholder:text-zinc-600" />
        </div>
        <button className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10"
          >
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${roleColor}`}>
              <span className="text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-white">{user?.name || 'User'}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{user?.role?.replace('_', ' ') || 'Viewer'}</p>
            </div>
          </button>

          {/* Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-12 w-56 rounded-xl bg-[#1a1a24] border border-white/10 shadow-2xl z-50 p-2">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-[10px] text-zinc-500">{user?.username} • {user?.role}</p>
                </div>
                {user?.role === 'admin' && (
                  <a href="/admin" className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Shield className="w-4 h-4 text-red-400" /> Admin Panel
                  </a>
                )}
                <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <User className="w-4 h-4 text-blue-400" /> My Profile
                </button>
                {onLogout && (
                  <button onClick={() => { setShowMenu(false); onLogout(); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors mt-1 border-t border-white/5 pt-2">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
