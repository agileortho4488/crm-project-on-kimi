import { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactFilterPanel, DEFAULT_FILTERS, type ContactFilters } from '@/components/contacts/ContactFilterPanel';
import { ContactDetailDrawer } from '@/components/contacts/ContactDetailDrawer';
import { BulkActionsBar } from '@/components/contacts/BulkActionsBar';
import { trpc } from '@/providers/trpc';
import { 
  Users, Filter, LayoutGrid, Table2, Download, Plus,
  RefreshCw
} from 'lucide-react';

interface Props {
  searchQuery?: string;
}

export function Contacts({ searchQuery }: Props) {
  // Filter state
  const [filters, setFilters] = useState<ContactFilters>({
    ...DEFAULT_FILTERS,
    search: searchQuery || '',
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Array<{ id: number; name: string; phone: string | null; division: string | null }>>([]);

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<number | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Stats
  const { data: stats, refetch: refetchStats } = trpc.contact.stats.useQuery();

  // Refresh helpers
  const utils = trpc.useUtils();
  const handleRefresh = useCallback(() => {
    utils.contact.list.invalidate();
    refetchStats();
  }, [utils, refetchStats]);

  // Selection handlers
  const handleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
    setSelectedContacts(prev => {
      // We don't have full contact data here, just track IDs
      // The actual data for export is fetched separately
      return prev;
    });
  }, []);

  const handleSelectAll = useCallback((ids: number[]) => {
    setSelectedIds(ids);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectedContacts([]);
  }, []);

  // Detail handlers
  const handleOpenDetail = useCallback((id: number) => {
    setDetailContactId(id);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailContactId(null);
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((newFilters: ContactFilters) => {
    setFilters(newFilters);
    // Reset selection when filters change
    handleClearSelection();
  }, [handleClearSelection]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    handleClearSelection();
  }, [handleClearSelection]);

  // Get selected contacts data for bulk actions
  // We fetch the selected contacts from the current page data
  const { data: currentPageData } = trpc.contact.list.useQuery({
    search: filters.search || undefined,
    division: filters.division || undefined,
    district: filters.district || undefined,
    status: filters.status || undefined,
    qualityMin: filters.qualityMin > 0 ? filters.qualityMin : undefined,
    qualityMax: filters.qualityMax < 100 ? filters.qualityMax : undefined,
    limit: 500,
    offset: 0,
  });

  const selectedContactsData = useMemo(() => {
    if (!currentPageData?.items) return [];
    return currentPageData.items
      .filter(item => selectedIds.includes(item.id))
      .map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        division: item.division,
      }));
  }, [currentPageData, selectedIds]);

  // Active filter badges
  const activeFilterBadges = [];
  if (filters.search) activeFilterBadges.push({ label: `Search: "${filters.search}"`, onRemove: () => setFilters(f => ({ ...f, search: '' })) });
  if (filters.division) activeFilterBadges.push({ label: `Division: ${filters.division}`, onRemove: () => setFilters(f => ({ ...f, division: undefined })) });
  if (filters.district) activeFilterBadges.push({ label: `District: ${filters.district}`, onRemove: () => setFilters(f => ({ ...f, district: undefined })) });
  if (filters.status) activeFilterBadges.push({ label: `Status: ${filters.status}`, onRemove: () => setFilters(f => ({ ...f, status: undefined })) });
  if (filters.qualityMin > 0 || filters.qualityMax < 100) {
    activeFilterBadges.push({ 
      label: `Quality: ${filters.qualityMin}-${filters.qualityMax}`, 
      onRemove: () => setFilters(f => ({ ...f, qualityMin: 0, qualityMax: 100 })) 
    });
  }

  return (
    <div className="flex h-full gap-0">
      {/* Filter Panel */}
      <ContactFilterPanel
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        isOpen={filterPanelOpen}
        onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-white/5">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Contacts
              </h1>
              <Badge className="bg-white/5 text-zinc-400 text-xs border-0">
                {stats?.total ? stats.total.toLocaleString() : '—'}
              </Badge>
              {!filterPanelOpen && activeFilterBadges.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">
                  {activeFilterBadges.length} filter{activeFilterBadges.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/5 text-xs gap-1.5"
                onClick={handleRefresh}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>

              {/* Export */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/5 text-xs gap-1.5"
                onClick={() => {
                  // Export current filtered results as CSV
                  alert('Export feature: Will download all filtered contacts as CSV');
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>

              {/* View toggle */}
              <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  <Table2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 ${viewMode === 'card' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Add contact */}
              <Button
                size="sm"
                className="h-8 bg-amber-500 text-black hover:bg-amber-400 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </Button>
            </div>
          </div>

          {/* Active filter badges */}
          {activeFilterBadges.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-600 uppercase">Active:</span>
              {activeFilterBadges.map((badge, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10 cursor-pointer hover:bg-amber-500/20 gap-1 pr-1"
                  onClick={badge.onRemove}
                >
                  {badge.label}
                  <span className="text-amber-600 hover:text-amber-300">x</span>
                </Badge>
              ))}
              <button
                onClick={handleClearFilters}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex-shrink-0 flex items-center gap-6 px-5 py-2 border-b border-white/5 bg-[#0c0c12]">
          {[
            { label: 'Total', value: stats?.total || 0, color: 'text-zinc-300' },
            { label: 'Doctors', value: stats?.doctors || 0, color: 'text-emerald-400' },
            { label: 'Hospitals', value: stats?.hospitals || 0, color: 'text-blue-400' },
            { label: 'Active', value: stats?.active || 0, color: 'text-amber-400' },
            { label: 'Divisions', value: stats?.withDivision || 0, color: 'text-purple-400' },
            { label: 'Avg Quality', value: `${stats?.avgQuality || 0}%`, color: 'text-pink-400', isText: true },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-600 uppercase">{stat.label}</span>
              <span className={`text-xs font-semibold ${stat.color}`}>
                {stat.isText ? stat.value : (stat.value as number).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ContactsTable
            filters={filters}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onOpenDetail={handleOpenDetail}
            onRefresh={handleRefresh}
          />
        </div>
      </div>

      {/* Contact Detail Drawer */}
      <ContactDetailDrawer
        contactId={detailContactId}
        open={detailOpen}
        onClose={handleCloseDetail}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedIds={selectedIds}
          selectedContacts={selectedContactsData}
          onClear={handleClearSelection}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
