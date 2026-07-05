import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, Mail, MapPin, Stethoscope, Building2, User, 
  Star, Calendar, ArrowUpRight, X, Edit2, Save, MessageCircle,
  Navigation, FileText, Clock
} from 'lucide-react';

interface Props {
  contactId: number | null;
  open: boolean;
  onClose: () => void;
}

const DIVISION_COLORS: Record<string, string> = {
  gynecology: '#ec4899', trauma_fracture: '#f97316', cardiovascular: '#ef4444',
  endo_surgery: '#10b981', neuro_spine: '#8b5cf6', diagnostics: '#06b6d4',
  consumables: '#f59e0b', unknown: '#6b7280',
};

const DIVISION_NAMES: Record<string, string> = {
  gynecology: 'Gynecology', trauma_fracture: 'Trauma & Fracture', cardiovascular: 'Cardiovascular',
  endo_surgery: 'Endo-Surgery', neuro_spine: 'Neuro & Spine', diagnostics: 'Diagnostics',
  consumables: 'Consumables', unknown: 'Unknown',
};

function getQualityColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 8) return phone || '—';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

export function ContactDetailDrawer({ contactId, open, onClose }: Props) {
  const { data: contact, isLoading } = trpc.contact.get.useQuery(
    { id: contactId! },
    { enabled: !!contactId }
  );

  const [editMode, setEditMode] = useState(false);

  if (!open || !contactId) return null;

  const divisionKey = (contact?.division || 'unknown') as string;
  const divisionColor = DIVISION_COLORS[divisionKey] || '#6b7280';
  const qualityScore = contact?.qualityScore || 0;
  const qualityColor = getQualityColor(qualityScore);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] bg-[#111118] border-l border-white/5 overflow-y-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !contact ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <User className="w-12 h-12 mb-3 opacity-30" />
            <p>Contact not found</p>
          </div>
        ) : (
          <>
            {/* Header with Avatar */}
            <div className="relative p-6 pb-4">
              <div className="flex items-start gap-4">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: divisionColor + '30', border: `2px solid ${divisionColor}` }}
                >
                  {getInitials(contact.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetHeader className="p-0">
                    <SheetTitle className="text-lg font-bold text-white leading-tight">
                      {contact.name}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge 
                      className="text-xs font-medium border-0"
                      style={{ backgroundColor: divisionColor + '20', color: divisionColor }}
                    >
                      {DIVISION_NAMES[divisionKey] || divisionKey}
                    </Badge>
                    {contact.specialty && (
                      <Badge variant="outline" className="text-xs text-zinc-400 border-white/10">
                        {contact.specialty}
                      </Badge>
                    )}
                    <Badge 
                      className="text-xs border-0"
                      style={{ 
                        backgroundColor: contact.status === 'active' ? '#10b98120' : contact.status === 'prospect' ? '#f59e0b20' : '#6b728020',
                        color: contact.status === 'active' ? '#10b981' : contact.status === 'prospect' ? '#f59e0b' : '#6b7280'
                      }}
                    >
                      {contact.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 text-zinc-300 flex flex-col h-auto py-2 gap-1">
                  <Phone className="w-4 h-4" />
                  <span className="text-[10px]">Call</span>
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 text-zinc-300 flex flex-col h-auto py-2 gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[10px]">WhatsApp</span>
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30 text-zinc-300 flex flex-col h-auto py-2 gap-1">
                  <Navigation className="w-4 h-4" />
                  <span className="text-[10px]">Map</span>
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/30 text-zinc-300 flex flex-col h-auto py-2 gap-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-[10px]">Email</span>
                </Button>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Quality Score */}
            <div className="p-6">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Data Quality</h3>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" style={{ color: qualityColor }} />
                    <span className="text-sm font-medium text-white">{qualityScore}/100</span>
                  </div>
                  <Badge 
                    className="text-[10px] border-0"
                    style={{ backgroundColor: qualityColor + '20', color: qualityColor }}
                  >
                    {qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : qualityScore >= 40 ? 'Fair' : 'Poor'}
                  </Badge>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ width: `${qualityScore}%`, backgroundColor: qualityColor }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[
                    { label: 'Name', score: contact.name?.length > 2 ? 20 : 0 },
                    { label: 'Phone', score: (contact.phone?.length || 0) >= 10 ? 25 : 0 },
                    { label: 'Hospital', score: contact.hospital?.length ? 15 : 0 },
                    { label: 'District', score: contact.district?.length ? 10 : 0 },
                    { label: 'Specialty', score: contact.specialty?.length ? 10 : 0 },
                    { label: 'Email', score: contact.email?.includes('@') ? 10 : 0 },
                    { label: 'Division', score: contact.division && contact.division !== 'unknown' ? 10 : 0 },
                    { label: 'Designation', score: contact.designation?.length ? 5 : 0 },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.score > 0 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      <span className={`text-[10px] ${item.score > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Contact Information */}
            <div className="p-6">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Contact Information</h3>
              <div className="space-y-3">
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={maskPhone(contact.phone)} />
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone 2" value={contact.phone2 || '—'} />
                <InfoRow icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" value={contact.whatsapp || '—'} />
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={contact.email || '—'} />
                <InfoRow icon={<Building2 className="w-4 h-4" />} label="Hospital" value={contact.hospital || '—'} />
                <InfoRow icon={<Stethoscope className="w-4 h-4" />} label="Designation" value={contact.designation || '—'} />
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="District" value={contact.district || '—'} />
                <InfoRow icon={<FileText className="w-4 h-4" />} label="Address" value={contact.address || '—'} />
                <InfoRow icon={<ArrowUpRight className="w-4 h-4" />} label="Source" value={contact.source || '—'} />
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Tags & Notes */}
            <div className="p-6">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Tags & Notes</h3>
              {contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {contact.tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs text-zinc-400 border-white/10">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-600 mb-3">No tags</p>
              )}
              {contact.notes ? (
                <p className="text-sm text-zinc-400 bg-white/5 rounded-lg p-3">{contact.notes}</p>
              ) : (
                <p className="text-sm text-zinc-600">No notes</p>
              )}
            </div>

            <Separator className="bg-white/5" />

            {/* Timestamps */}
            <div className="p-6 pb-8">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Timestamps</h3>
              <div className="space-y-2">
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Created" value={contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-IN') : '—'} />
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Updated" value={contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString('en-IN') : '—'} />
                {contact.lastContact && (
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Last Contact" value={new Date(contact.lastContact).toLocaleDateString('en-IN')} />
                )}
                {contact.nextFollowUp && (
                  <InfoRow icon={<Calendar className="w-4 h-4" />} label="Next Follow-up" value={new Date(contact.nextFollowUp).toLocaleDateString('en-IN')} />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-zinc-500 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
        <p className={`text-sm ${value === '—' ? 'text-zinc-600' : 'text-zinc-200'} truncate`}>{value}</p>
      </div>
    </div>
  );
}
