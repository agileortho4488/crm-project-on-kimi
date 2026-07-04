import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/providers/trpc';
import { Target, Clock, User, X } from 'lucide-react';

const stageCfg: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#3b82f6' },
  qualified: { label: 'Qualified', color: '#8b5cf6' },
  proposal: { label: 'Proposal', color: '#f59e0b' },
  negotiation: { label: 'Negotiation', color: '#ec4899' },
  closed_won: { label: 'Won', color: '#10b981' },
  closed_lost: { label: 'Lost', color: '#ef4444' },
};

const priorityColors: Record<string, string> = {
  low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface LeadsProps { searchQuery: string; }

export function Leads({ searchQuery }: LeadsProps) {
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState({ title: '', contactName: '', value: 0, priority: 'medium' as const, stage: 'new' as const, division: '' });

  const { data, refetch } = trpc.lead.list.useQuery({ search: searchQuery || undefined, limit: 200 });
  const { data: leadDetail } = trpc.lead.get.useQuery({ id: selectedLead! }, { enabled: selectedLead !== null });
  const createMutation = trpc.lead.create.useMutation({ onSuccess: () => { refetch(); setShowAdd(false); } });
  const updateMutation = trpc.lead.update.useMutation({ onSuccess: () => refetch() });

  const leads = data?.items || [];
  const stages = ['new', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'pipeline' | 'list')}>
            <TabsList className="bg-[#111118] border border-white/5">
              <TabsTrigger value="pipeline" className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">Pipeline</TabsTrigger>
              <TabsTrigger value="list" className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm font-bold text-amber-400">₹{(leads.filter(l => l.stage !== 'closed_won' && l.stage !== 'closed_lost').reduce((s, l) => s + (l.value || 0), 0) / 100000).toFixed(1)}L Pipeline</p>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => setShowAdd(true)}>Add Lead</Button>
        </div>
      </div>

      {viewMode === 'pipeline' ? (
        <ScrollArea className="flex-1">
          <div className="flex gap-4 min-w-max pb-2">
            {stages.map((stage) => {
              const cfg = stageCfg[stage];
              const stageLeads = leads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="w-72 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-xs font-semibold text-zinc-300">{cfg.label}</span>
                      <span className="text-[10px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded-full">{stageLeads.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <Card key={lead.id} className="bg-[#111118] border-white/5 hover:border-amber-500/30 cursor-pointer transition-all" onClick={() => setSelectedLead(lead.id)}>
                        <CardContent className="p-3">
                          <p className="text-xs font-medium text-zinc-200 line-clamp-2">{lead.title}</p>
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500 mt-2"><User className="w-3 h-3" /> {lead.contactId || 'No contact'}</span>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs font-bold text-amber-400">₹{((lead.value || 0) / 100000).toFixed(1)}L</span>
                            <Badge variant="outline" className={`text-[9px] ${priorityColors[lead.priority || 'medium']}`}>{lead.priority || 'medium'}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {leads.map((lead) => {
              const cfg = stageCfg[lead.stage || 'new'];
              return (
                <Card key={lead.id} className="bg-[#111118] border-white/5 hover:border-amber-500/30 cursor-pointer transition-all" onClick={() => setSelectedLead(lead.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{lead.title}</p>
                          <Badge variant="outline" className="text-[9px]" style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}>{cfg.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {lead.division}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString() : 'No date'}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-amber-400">₹{((lead.value || 0) / 100000).toFixed(1)}L</p>
                        <Badge variant="outline" className={`text-[9px] mt-1 ${priorityColors[lead.priority || 'medium']}`}>{lead.priority || 'medium'}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {selectedLead !== null && leadDetail && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-[#111118] border-l border-white/10 shadow-2xl z-50 overflow-auto">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div><h3 className="text-lg font-semibold text-white">{leadDetail.title}</h3>
                <Badge variant="outline" className="text-[10px] mt-1" style={{ color: stageCfg[leadDetail.stage || 'new'].color, borderColor: `${stageCfg[leadDetail.stage || 'new'].color}40`, backgroundColor: `${stageCfg[leadDetail.stage || 'new'].color}10` }}>{stageCfg[leadDetail.stage || 'new'].label}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="text-zinc-500" onClick={() => setSelectedLead(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 mb-4">
              <p className="text-xs text-zinc-500 mb-2">Deal Value</p>
              <p className="text-2xl font-bold text-amber-400">₹{((leadDetail.value || 0) / 100000).toFixed(1)}L</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-white/[0.02]"><p className="text-[10px] text-zinc-500">Division</p><p className="text-sm text-zinc-200">{leadDetail.division || 'N/A'}</p></div>
              <div className="p-3 rounded-lg bg-white/[0.02]"><p className="text-[10px] text-zinc-500">Priority</p><p className="text-sm text-zinc-200 capitalize">{leadDetail.priority || 'medium'}</p></div>
              <div className="p-3 rounded-lg bg-white/[0.02]"><p className="text-[10px] text-zinc-500">Assigned To</p><p className="text-sm text-zinc-200">{leadDetail.assignedTo || 'Unassigned'}</p></div>
              <div className="p-3 rounded-lg bg-white/[0.02]"><p className="text-[10px] text-zinc-500">Expected Close</p><p className="text-sm text-zinc-200">{leadDetail.expectedCloseDate ? new Date(leadDetail.expectedCloseDate).toLocaleDateString() : 'N/A'}</p></div>
            </div>
            <div className="flex gap-2">
              {['qualified', 'proposal', 'negotiation', 'closed_won'].map((s) => (
                <Button key={s} size="sm" variant="outline" className="text-[10px] border-white/10" onClick={() => updateMutation.mutate({ id: leadDetail.id, stage: s as any })}>{stageCfg[s].label}</Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#111118] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Lead Title *" value={newLead.title} onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Contact Name" value={newLead.contactName} onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Value (₹)" type="number" value={newLead.value} onChange={(e) => setNewLead({ ...newLead, value: Number(e.target.value) })} className="bg-white/5 border-white/10" />
            <Input placeholder="Division" value={newLead.division} onChange={(e) => setNewLead({ ...newLead, division: e.target.value })} className="bg-white/5 border-white/10" />
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => createMutation.mutate(newLead)}>Create Lead</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
