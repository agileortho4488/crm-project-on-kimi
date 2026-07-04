import { Search, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  title: string;
}

export function Header({ searchQuery, onSearchChange, title }: HeaderProps) {
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
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-400">AH</span>
          </div>
          {!searchQuery && <div className="hidden md:block"><p className="text-xs font-medium text-white">Admin</p><p className="text-[10px] text-zinc-500">Manager</p></div>}
        </div>
      </div>
    </header>
  );
}
