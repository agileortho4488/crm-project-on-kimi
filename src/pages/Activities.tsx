import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/providers/trpc';
import { Phone, MapPin, CalendarDays, Mail, MessageCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

const typeCfg: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  call: { icon: Phone, color: '#3b82f6', label: 'Call' },
  visit: { icon: MapPin, color: '#10b981', label: 'Visit' },
  meeting: { icon: CalendarDays, color: '#8b5cf6', label: 'Meeting' },
  email: { icon: Mail, color: '#f59e0b', label: 'Email' },
  whatsapp: { icon: MessageCircle, color: '#22c55e', label: 'WhatsApp' },
  demo: { icon: ArrowRight, color: '#ec4899', label: 'Demo' },
  follow_up: { icon: ArrowRight, color: '#06b6d4', label: 'Follow-up' },
  order: { icon: CheckCircle2, color: '#84cc16', label: 'Order' },
  note: { icon: ArrowRight, color: '#a1a1aa', label: 'Note' },
};

export function Activities() {
  const [filterType, setFilterType] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'call' as const, description: '', outcome: '', contactId: '' });

  const { data, refetch } = trpc.activity.list.useQuery({ type: filterType === 'all' ? undefined : filterType, limit: 100 });
  const createMutation = trpc.activity.create.useMutation({ onSuccess: () => { refetch(); setShowAdd(false); } });

  const activities = data?.items || [];
  const grouped = activities.reduce((acc: Record<string, typeof activities>, a) => {
    const date = new Date(a.createdAt).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between">
        <Tabs value={filterType} onValueChange={setFilterType}>
          <TabsList className="bg-[#111118] border border-white/5">
            {['all', 'call', 'visit', 'meeting', 'demo', 'whatsapp'].map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 capitalize">{t}s</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <button className="text-xs text-amber-400 hover:text-amber-300 font-medium" onClick={() => setShowAdd(true)}>+ Log Activity</button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pr-2">
          {Object.entries(grouped).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3"><div className="h-px flex-1 bg-white/5" /><Badge variant="outline" className="bg-[#111118] text-zinc-400 border-white/10 text-[10px]">{date}</Badge><div className="h-px flex-1 bg-white/5" /></div>
              <div className="space-y-2">
                {items.map((activity) => {
                  const cfg = typeCfg[activity.type] || typeCfg.note;
                  const Icon = cfg.icon;
                  return (
                    <Card key={activity.id} className="bg-[#111118] border-white/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: `${cfg.color}15` }}>
                            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-zinc-300 capitalize">{activity.type.replace('_', ' ')}</span>
                              <span className="text-[10px] text-zinc-600">{new Date(activity.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm text-white">{activity.description}</p>
                            {activity.outcome && <Badge variant="outline" className="mt-2 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{activity.outcome}</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#111118] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <select value={newActivity.type} onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              {Object.entries(typeCfg).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
            </select>
            <Input placeholder="Description *" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Outcome" value={newActivity.outcome} onChange={(e) => setNewActivity({ ...newActivity, outcome: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Contact ID (optional)" value={newActivity.contactId} onChange={(e) => setNewActivity({ ...newActivity, contactId: e.target.value })} className="bg-white/5 border-white/10" />
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => createMutation.mutate({ ...newActivity, contactId: newActivity.contactId ? Number(newActivity.contactId) : undefined, description: newActivity.description })}>Log Activity</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
