import { useState, useEffect } from 'react';
import { trpc } from '@/providers/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  Search, X, Filter, ChevronDown, ChevronRight, Star, Zap,
  Phone, MapPin, Stethoscope, Heart, UserX, Clock
} from 'lucide-react';

export interface ContactFilters {
  search: string;
  division: string | undefined;
  district: string | undefined;
  status: string | undefined;
  qualityMin: number;
  qualityMax: number;
  type: string | undefined;
}

interface Props {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const QUICK_FILTERS = [
  { id: 'high_quality', label: 'High Quality (70+)', icon: Star, description: 'Score 70-100' },
  { id: 'missing_phone', label: 'No Phone', icon: Phone, description: 'Phone field empty' },
  { id: 'my_division', label: 'My Division', icon: Stethoscope, description: 'Assigned to you' },
  { id: 'follow_up', label: 'Follow-up Due', icon: Clock, description: 'Past due date' },
];

const DIVISION_OPTIONS = [
  { value: 'gynecology', label: 'Gynecology', color: '#ec4899' },
  { value: 'trauma_fracture', label: 'Trauma & Fracture', color: '#f97316' },
  { value: 'cardiovascular', label: 'Cardiovascular', color: '#ef4444' },
  { value: 'neuro_spine', label: 'Neuro & Spine', color: '#8b5cf6' },
  { value: 'endo_surgery', label: 'Endo-Surgery', color: '#10b981' },
  { value: 'diagnostics', label: 'Diagnostics', color: '#06b6d4' },
  { value: 'consumables', label: 'Consumables', color: '#f59e0b' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'inactive', label: 'Inactive', color: '#6b7280' },
  { value: 'prospect', label: 'Prospect', color: '#f59e0b' },
  { value: 'blacklisted', label: 'Blacklisted', color: '#ef4444' },
];

const DEFAULT_FILTERS: ContactFilters = {
  search: '',
  division: undefined,
  district: undefined,
  status: undefined,
  qualityMin: 0,
  qualityMax: 100,
  type: undefined,
};

export function ContactFilterPanel({ filters, onChange, onClear, isOpen, onToggle }: Props) {
  const { data: filterOptions } = trpc.contact.filterOptions.useQuery();
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quick: true,
    division: true,
    district: true,
    status: true,
    quality: true,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onChange({ ...filters, search: localSearch });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilterCount = [
    filters.division,
    filters.district,
    filters.status,
    filters.search,
    filters.qualityMin > 0 || filters.qualityMax < 100 ? 'quality' : null,
  ].filter(Boolean).length;

  return (
    <>
      {/* Toggle Button (when collapsed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-[#1a1a24] border border-white/10 border-l-0 rounded-r-lg p-2 hover:bg-white/5 transition-colors shadow-lg"
        >
          <Filter className="w-4 h-4 text-zinc-400" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {/* Filter Panel */}
      <div className={`${isOpen ? 'w-72' : 'w-0'} flex-shrink-0 bg-[#111118] border-r border-white/5 overflow-hidden transition-all duration-200 flex flex-col`}>
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 text-[10px] border-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-zinc-400 hover:text-white" onClick={onClear}>
                    Clear
                  </Button>
                )}
                <button onClick={onToggle} className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  placeholder="Search name, phone, hospital..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-8 h-8 bg-white/5 border-white/10 text-white text-xs placeholder:text-zinc-600 focus-visible:ring-amber-500/30"
                />
                {localSearch && (
                  <button onClick={() => setLocalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable filter sections */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {/* Quick Filters */}
              <FilterSection title="Quick Filters" sectionKey="quick" expanded={expandedSections} toggle={toggleSection}>
                <div className="space-y-1">
                  {QUICK_FILTERS.map(qf => {
                    const Icon = qf.icon;
                    const isActive = 
                      (qf.id === 'high_quality' && filters.qualityMin >= 70) ||
                      (qf.id === 'missing_phone' && filters.search === 'no phone');
                    return (
                      <button
                        key={qf.id}
                        onClick={() => {
                          if (qf.id === 'high_quality') {
                            onChange({ ...filters, qualityMin: isActive ? 0 : 70, qualityMax: 100 });
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isActive ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {qf.label}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <Separator className="bg-white/5" />

              {/* Division Filter */}
              <FilterSection title="Division" sectionKey="division" expanded={expandedSections} toggle={toggleSection}>
                <div className="space-y-1">
                  {DIVISION_OPTIONS.map(div => {
                    const count = filterOptions?.divisions.find(d => d.value === div.value)?.count || 0;
                    const isSelected = filters.division === div.value;
                    return (
                      <button
                        key={div.value}
                        onClick={() => onChange({ ...filters, division: isSelected ? undefined : div.value })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: div.color }} />
                        <span className="flex-1 text-left truncate">{div.label}</span>
                        <span className="text-zinc-600 text-[10px]">{count > 0 ? count.toLocaleString() : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <Separator className="bg-white/5" />

              {/* District Filter */}
              <FilterSection title="District" sectionKey="district" expanded={expandedSections} toggle={toggleSection}>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filterOptions?.districts.slice(0, 50).map(dist => {
                    const isSelected = filters.district === dist.value;
                    return (
                      <button
                        key={dist.value}
                        onClick={() => onChange({ ...filters, district: isSelected ? undefined : dist.value })}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                          isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <MapPin className="w-3 h-3 flex-shrink-0 text-zinc-600" />
                        <span className="flex-1 text-left truncate">{dist.value}</span>
                        <span className="text-zinc-600 text-[10px]">{dist.count > 0 ? dist.count.toLocaleString() : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <Separator className="bg-white/5" />

              {/* Status Filter */}
              <FilterSection title="Status" sectionKey="status" expanded={expandedSections} toggle={toggleSection}>
                <div className="space-y-1">
                  {STATUS_OPTIONS.map(st => {
                    const count = filterOptions?.statuses.find(s => s.value === st.value)?.count || 0;
                    const isSelected = filters.status === st.value;
                    return (
                      <button
                        key={st.value}
                        onClick={() => onChange({ ...filters, status: isSelected ? undefined : st.value })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="flex-1 text-left">{st.label}</span>
                        <span className="text-zinc-600 text-[10px]">{count > 0 ? count.toLocaleString() : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <Separator className="bg-white/5" />

              {/* Quality Score Filter */}
              <FilterSection title="Quality Score" sectionKey="quality" expanded={expandedSections} toggle={toggleSection}>
                <div className="px-2 py-2">
                  <Slider
                    value={[filters.qualityMin, filters.qualityMax]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([min, max]) => onChange({ ...filters, qualityMin: min, qualityMax: max })}
                    className="my-3"
                  />
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                    <span>{filters.qualityMin}</span>
                    <span className="text-zinc-400">{filters.qualityMin}-{filters.qualityMax}</span>
                    <span>{filters.qualityMax}</span>
                  </div>
                </div>
              </FilterSection>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function FilterSection({ 
  title, sectionKey, expanded, toggle, children 
}: { 
  title: string; 
  sectionKey: string; 
  expanded: Record<string, boolean>; 
  toggle: (k: string) => void;
  children: React.ReactNode;
}) {
  const isExpanded = expanded[sectionKey] ?? true;
  return (
    <div className="py-2">
      <button
        onClick={() => toggle(sectionKey)}
        className="w-full flex items-center justify-between text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {isExpanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

export { DEFAULT_FILTERS };
