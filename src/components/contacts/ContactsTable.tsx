import { useRef, useState, useCallback, useMemo } from 'react';
import { trpc } from '@/providers/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ChevronUp, ChevronDown, ChevronsUpDown, Loader2, 
  RefreshCw, MoreHorizontal, Eye, Phone, MessageCircle,
  ArrowUpDown
} from 'lucide-react';
import type { ContactFilters } from './ContactFilterPanel';

interface Props {
  filters: ContactFilters;
  selectedIds: number[];
  onSelect: (id: number) => void;
  onSelectAll: (ids: number[]) => void;
  onClearSelection: () => void;
  onOpenDetail: (id: number) => void;
  onRefresh: () => void;
}

const DIVISION_COLORS: Record<string, string> = {
  gynecology: '#ec4899', trauma_fracture: '#f97316', cardiovascular: '#ef4444',
  endo_surgery: '#10b981', neuro_spine: '#8b5cf6', diagnostics: '#06b6d4',
  consumables: '#f59e0b', unknown: '#6b7280',
};

const DIVISION_LABELS: Record<string, string> = {
  gynecology: 'GYN', trauma_fracture: 'ORTHO', cardiovascular: 'CARDIO',
  endo_surgery: 'ENDO', neuro_spine: 'NEURO', diagnostics: 'DIAG',
  consumables: 'CONS', unknown: '—',
};

function getQualityColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 8) return phone || '—';
  return phone.slice(0, 3) + '****' + phone.slice(-2);
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

const COLUMN_DEFS = [
  { key: 'name', label: 'Name', width: 220 },
  { key: 'phone', label: 'Phone', width: 120 },
  { key: 'specialty', label: 'Specialty', width: 150 },
  { key: 'hospital', label: 'Hospital', width: 180 },
  { key: 'district', label: 'District', width: 130 },
  { key: 'division', label: 'Division', width: 100 },
  { key: 'qualityScore', label: 'Quality', width: 90 },
  { key: 'status', label: 'Status', width: 90 },
];

export function ContactsTable({ filters, selectedIds, onSelect, onSelectAll, onClearSelection, onOpenDetail, onRefresh }: Props) {
  const [sort, setSort] = useState<SortConfig>({ column: 'updatedAt', direction: 'desc' });
  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const limit = 100;

  // Fetch data
  const { data, isLoading, isFetching } = trpc.contact.list.useQuery({
    search: filters.search || undefined,
    division: filters.division || undefined,
    district: filters.district || undefined,
    status: filters.status || undefined,
    qualityMin: filters.qualityMin > 0 ? filters.qualityMin : undefined,
    qualityMax: filters.qualityMax < 100 ? filters.qualityMax : undefined,
    sortBy: sort.column as any,
    sortOrder: sort.direction,
    limit,
    offset,
  }, {
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const total = data?.total || 0;

  // Handle sort
  const handleSort = useCallback((column: string) => {
    setOffset(0);
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sort.column !== column) return <ArrowUpDown className="w-3 h-3 text-zinc-600" />;
    return sort.direction === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
      : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />;
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // Compute visible page range for pagination
  const pageRange = useMemo(() => {
    const range: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col h-full">
      {/* Table container with scroll */}
      <div ref={containerRef} className="flex-1 overflow-auto min-h-0">
        {/* Header row */}
        <div 
          className="sticky top-0 z-10 grid bg-[#0f0f16] border-b border-white/5"
          style={{ 
            gridTemplateColumns: `40px ${COLUMN_DEFS.map(c => `${c.width}px`).join(' ')} 80px`,
          }}
        >
          {/* Select all checkbox */}
          <div className="flex items-center justify-center py-2.5 px-2">
            <Checkbox
              checked={items.length > 0 && items.every(item => selectedIds.includes(item.id))}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectAll(items.map(i => i.id));
                } else {
                  onClearSelection();
                }
              }}
              className="border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
          </div>

          {/* Column headers */}
          {COLUMN_DEFS.map(col => (
            <button
              key={col.key}
              onClick={() => handleSort(col.key)}
              className="flex items-center gap-1 px-3 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors text-left"
            >
              {col.label}
              {getSortIcon(col.key)}
            </button>
          ))}

          {/* Actions header */}
          <div className="px-3 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider text-left">
            Actions
          </div>
        </div>

        {/* Loading state */}
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="ml-2 text-sm text-zinc-500">Loading contacts...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-400 mb-1">No contacts found</p>
            <p className="text-xs text-zinc-600">Try adjusting your filters or search</p>
          </div>
        )}

        {/* Data rows */}
        {items.map((contact, idx) => {
          const isSelected = selectedIds.includes(contact.id);
          const divisionKey = contact.division || 'unknown';
          const divisionColor = DIVISION_COLORS[divisionKey] || '#6b7280';
          const qualityScore = contact.qualityScore || 0;
          const qualityColor = getQualityColor(qualityScore);
          const isEven = idx % 2 === 0;

          return (
            <div
              key={contact.id}
              onClick={(e) => {
                // Don't navigate if clicking checkbox
                if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
                onOpenDetail(contact.id);
              }}
              className={`grid border-b border-white/[0.03] cursor-pointer transition-colors group ${
                isSelected ? 'bg-amber-500/5' : isEven ? 'bg-transparent' : 'bg-white/[0.01]'
              } hover:bg-white/[0.04]`}
              style={{ 
                gridTemplateColumns: `40px ${COLUMN_DEFS.map(c => `${c.width}px`).join(' ')} 80px`,
              }}
            >
              {/* Checkbox */}
              <div className="flex items-center justify-center py-2 px-2" data-checkbox>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect(contact.id)}
                  className="border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                />
              </div>

              {/* Name */}
              <div className="flex items-center gap-2.5 px-3 py-2 min-w-0">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: divisionColor + '30', border: `1.5px solid ${divisionColor}50` }}
                >
                  {getInitials(contact.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                    {contact.name}
                  </p>
                  {contact.designation && (
                    <p className="text-[10px] text-zinc-600 truncate">{contact.designation}</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center px-3 py-2">
                <span className="text-[12px] text-zinc-400 font-mono">{maskPhone(contact.phone)}</span>
              </div>

              {/* Specialty */}
              <div className="flex items-center px-3 py-2">
                <span className="text-[12px] text-zinc-400 truncate">{contact.specialty || '—'}</span>
              </div>

              {/* Hospital */}
              <div className="flex items-center px-3 py-2">
                <span className="text-[12px] text-zinc-400 truncate">{contact.hospital || '—'}</span>
              </div>

              {/* District */}
              <div className="flex items-center px-3 py-2">
                <span className="text-[12px] text-zinc-400">{contact.district || '—'}</span>
              </div>

              {/* Division */}
              <div className="flex items-center px-3 py-2">
                <Badge 
                  className="text-[10px] font-medium border-0 px-1.5 py-0.5"
                  style={{ backgroundColor: divisionColor + '20', color: divisionColor }}
                >
                  {DIVISION_LABELS[divisionKey] || divisionKey.slice(0, 6)}
                </Badge>
              </div>

              {/* Quality */}
              <div className="flex items-center px-3 py-2 gap-2">
                <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                  <div 
                    className="h-full rounded-full"
                    style={{ width: `${qualityScore}%`, backgroundColor: qualityColor }}
                  />
                </div>
                <span className="text-[11px] text-zinc-500 w-6 text-right">{qualityScore}</span>
              </div>

              {/* Status */}
              <div className="flex items-center px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ 
                      backgroundColor: contact.status === 'active' ? '#10b981' 
                        : contact.status === 'prospect' ? '#f59e0b' 
                        : contact.status === 'blacklisted' ? '#ef4444' 
                        : '#6b7280' 
                    }}
                  />
                  <span className="text-[11px] text-zinc-400 capitalize">{contact.status}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 px-2 py-2" onClick={e => e.stopPropagation()}>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0 text-zinc-600 hover:text-white hover:bg-white/5"
                  onClick={() => onOpenDetail(contact.id)}
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {contact.phone && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-green-400 hover:bg-green-500/10"
                    onClick={() => window.open(`https://wa.me/91${contact.phone!.replace(/\D/g, '').slice(-10)}`, '_blank')}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Fetch more indicator */}
        {isFetching && items.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin mr-2" />
            <span className="text-xs text-zinc-500">Loading more...</span>
          </div>
        )}
      </div>

      {/* Footer: Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 bg-[#0f0f16]">
          <div className="text-xs text-zinc-500">
            Showing <span className="text-zinc-300">{offset + 1}-{Math.min(offset + limit, total)}</span> of{' '}
            <span className="text-zinc-300">{total.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* First page */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
              disabled={offset === 0}
              onClick={() => setOffset(0)}
            >
              <ChevronsUpDown className="w-3 h-3 rotate-90" />
            </Button>

            {/* Page numbers */}
            {pageRange.map(page => (
              <Button
                key={page}
                size="sm"
                variant={page === currentPage ? 'default' : 'ghost'}
                className={`h-7 min-w-7 px-2 text-[11px] ${
                  page === currentPage 
                    ? 'bg-amber-500 text-black hover:bg-amber-400' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setOffset((page - 1) * limit)}
              >
                {page}
              </Button>
            ))}

            {/* Refresh */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
              onClick={onRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
