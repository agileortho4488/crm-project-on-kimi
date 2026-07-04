import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/providers/trpc';
import { districts, divisionNames } from '@/types';
import { Phone, Mail, MapPin, Stethoscope, Building2, Filter, ChevronRight, Clock, Tag, MessageCircle, X, Plus } from 'lucide-react';

interface ContactsProps { searchQuery: string; }

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  prospect: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  blacklisted: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function Contacts({ searchQuery }: ContactsProps) {
  const [filterType, setFilterType] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', specialty: '', hospital: '', district: '', division: '' });

  const { data, refetch } = trpc.contact.list.useQuery({
    search: searchQuery || undefined,
    type: filterType === 'all' ? undefined : filterType,
    district: filterDistrict === 'all' ? undefined : filterDistrict,
    limit: 200,
  });

  const { data: detailContact } = trpc.contact.get.useQuery(
    { id: showDetail! },
    { enabled: showDetail !== null }
  );

  const createMutation = trpc.contact.create.useMutation({ onSuccess: () => { refetch(); setShowAdd(false); setNewContact({ name: '', phone: '', email: '', specialty: '', hospital: '', district: '', division: '' }); } });
  const deleteMutation = trpc.contact.delete.useMutation({ onSuccess: () => { refetch(); setShowDetail(null); } });

  const contacts = data?.items || [];

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      <div className={`flex flex-col gap-4 ${showDetail !== null ? 'flex-1 lg:flex-[0.6]' : 'flex-1'}`}>
        <div className="flex items-center justify-between">
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList className="bg-[#111118] border border-white/5">
              {['all', 'doctor', 'hospital', 'distributor'].map((t) => (
                <TabsTrigger key={t} value={t} className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 capitalize">{t}s</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 px-2 py-1.5 outline-none">
              <option value="all">All Districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {contacts.map((contact) => (
              <Card key={contact.id} className={`bg-[#111118] border-white/5 hover:border-amber-500/30 cursor-pointer transition-all ${showDetail === contact.id ? 'border-amber-500/40 bg-amber-500/5' : ''}`} onClick={() => setShowDetail(contact.id)}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${statusColors[contact.status]}`}>{contact.status}</Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{contact.specialty} {contact.hospital ? `· ${contact.hospital}` : ''}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {contact.phone && <span className="flex items-center gap-1 text-[10px] text-zinc-400"><Phone className="w-3 h-3" /> {contact.phone}</span>}
                        {contact.district && <span className="flex items-center gap-1 text-[10px] text-zinc-400"><MapPin className="w-3 h-3" /> {contact.district}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {showDetail !== null && detailContact && (
        <div className="hidden lg:flex flex-col flex-[0.4] gap-4">
          <Card className="bg-[#111118] border-white/5 flex-1">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-amber-400">{detailContact.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{detailContact.name}</h3>
                    <p className="text-xs text-zinc-500">{detailContact.specialty || 'No specialty'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-zinc-500" onClick={() => setShowDetail(null)}><X className="w-4 h-4" /></Button>
              </div>

              <div className="space-y-2">
                {detailContact.phone && <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]"><Phone className="w-4 h-4 text-emerald-400" /><div><p className="text-xs text-zinc-500">Phone</p><p className="text-sm text-zinc-200">{detailContact.phone}</p></div></div>}
                {detailContact.email && <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]"><Mail className="w-4 h-4 text-blue-400" /><div><p className="text-xs text-zinc-500">Email</p><p className="text-sm text-zinc-200">{detailContact.email}</p></div></div>}
                {detailContact.district && <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]"><MapPin className="w-4 h-4 text-purple-400" /><div><p className="text-xs text-zinc-500">District</p><p className="text-sm text-zinc-200">{detailContact.district}</p></div></div>}
                {detailContact.hospital && <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]"><Building2 className="w-4 h-4 text-cyan-400" /><div><p className="text-xs text-zinc-500">Hospital</p><p className="text-sm text-zinc-200">{detailContact.hospital}</p></div></div>}
                {detailContact.division && <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]"><Tag className="w-4 h-4 text-amber-400" /><div><p className="text-xs text-zinc-500">Division</p><p className="text-sm text-zinc-200">{detailContact.division}</p></div></div>}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black text-xs flex-1"><Phone className="w-3 h-3 mr-1" /> Call</Button>
                  <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs flex-1"><MessageCircle className="w-3 h-3 mr-1" /> WhatsApp</Button>
                </div>

                {detailContact.tags && (detailContact.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {(detailContact.tags as string[]).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[9px] bg-amber-500/5 text-amber-400 border-amber-500/20">{tag}</Badge>
                    ))}
                  </div>
                )}

                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 mt-2" onClick={() => detailContact.id && deleteMutation.mutate({ id: detailContact.id })}>Delete Contact</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#111118] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Add New Contact</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Full Name *" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Specialty" value={newContact.specialty} onChange={(e) => setNewContact({ ...newContact, specialty: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Hospital" value={newContact.hospital} onChange={(e) => setNewContact({ ...newContact, hospital: e.target.value })} className="bg-white/5 border-white/10" />
            <select value={newContact.district} onChange={(e) => setNewContact({ ...newContact, district: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Select District</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={newContact.division} onChange={(e) => setNewContact({ ...newContact, division: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Select Division</option>
              {divisionNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => createMutation.mutate({ ...newContact, type: 'doctor' })}>Create Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
