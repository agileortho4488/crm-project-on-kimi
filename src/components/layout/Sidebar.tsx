import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Target, CalendarDays, ClipboardList, Package, BarChart3, Upload, Stethoscope, ChevronLeft, ChevronRight, Megaphone, Sparkles, Wand2, Shield, MapPin, Globe } from 'lucide-react';
import type { AppPage } from '@/types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: AppPage) => void;
  collapsed: boolean;
  onToggle: () => void;
  userRole?: string;
}

const navItems: { id: AppPage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'leads', label: 'Leads & Pipeline', icon: Target },
  { id: 'activities', label: 'Activities', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'imports', label: 'Data Imports', icon: Upload },
  { id: 'dataquality', label: 'Data Quality', icon: Sparkles },
  { id: 'enrichmenthub', label: 'Enrichment Hub', icon: Wand2 },
  { id: 'onlineenrichment', label: 'Online Enrich', icon: Globe },
  { id: 'maps', label: 'Maps', icon: MapPin },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle, userRole }: SidebarProps) {
  const isAdmin = userRole === 'admin';

  return (
    <aside className={cn('flex flex-col bg-[#111118] border-r border-white/5 transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
          <Stethoscope className="w-4 h-4 text-amber-400" />
        </div>
        {!collapsed && <div className="flex flex-col"><span className="text-sm font-bold text-white tracking-wide">AGILE</span><span className="text-[10px] text-zinc-500 uppercase tracking-wider">Master CRM</span></div>}
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all', isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5')}>
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-amber-400')} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
        {/* Admin Panel - only for admin */}
        {isAdmin && (
          <button
            onClick={() => onNavigate('adminpanel')}
            className={cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all', currentPage === 'adminpanel' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5')}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
      </nav>
      <button onClick={onToggle} className="flex items-center justify-center h-10 border-t border-white/5 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
