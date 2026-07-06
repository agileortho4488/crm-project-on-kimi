import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { trpc } from '@/providers/trpc';
import { 
  Globe, Search, Building2, MapPin, Loader2, ExternalLink,
  ChevronLeft, ChevronRight, Stethoscope, Phone, Mail, Star,
  RefreshCw, Filter, UserCheck, AlertCircle
} from 'lucide-react';

export function OnlineEnrichmentHub() {
  const [selectedDivision, setSelectedDivision] = useState<string>('gynecology');
  const [offset, setOffset] = useState(0);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [enrichedCount, setEnrichedCount] = useState(0);

  const limit = 20;

  // Get enrichment targets
  const { data, isLoading, refetch } = trpc.onlineEnrichment.getEnrichmentTargets.useQuery({
    division: selectedDivision,
    limit,
    offset,
  });

  // Get enrichment progress
  const { data: progress, refetch: refetchProgress } = trpc.onlineEnrichment.enrichmentProgress.useQuery();

  // Manual enrich mutation
  const enrichMutation = trpc.onlineEnrichment.manualEnrich.useMutation({
    onSuccess: () => {
      setEnrichedCount(c => c + 1);
      setEditingContact(null);
      refetch();
      refetchProgress();
    },
  });

  const targets = data?.items || [];
  const total = data?.total || 0;

  const divisions = [
    { key: 'gynecology', label: 'Gynecology', color: '#ec4899' },
    { key: 'trauma_fracture', label: 'Trauma & Fracture', color: '#f97316' },
    { key: 'cardiovascular', label: 'Cardiovascular', color: '#ef4444' },
    { key: 'neuro_spine', label: 'Neuro & Spine', color: '#8b5cf6' },
    { key: 'endo_surgery', label: 'Endo-Surgery', color: '#10b981' },
    { key: 'diagnostics', label: 'Diagnostics', color: '#06b6d4' },
    { key: 'consumables', label: 'Consumables', color: '#f59e0b' },
  ];

  const currentDiv = divisions.find(d => d.key === selectedDivision);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-sky-400" />
            Online Enrichment Hub
          </h1>
          <p className="text-sm text-zinc-500">Find doctor workplaces from Practo, Google, Justdial & more</p>
        </div>
        <div className="flex items-center gap-2">
          {enrichedCount > 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
              <UserCheck className="w-3 h-3 mr-1" /> {enrichedCount} enriched this session
            </Badge>
          )}
          <Button size="sm" variant="outline" className="border-white/10 text-zinc-400" onClick={() => { refetch(); refetchProgress(); }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Stats */}
      {progress && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Contacts" value={progress.total} color="text-white" />
          <StatCard label="With Hospital" value={progress.withHospital} color="text-emerald-400" subtitle={`${(progress.withHospital/progress.total*100).toFixed(1)}%`} />
          <StatCard label="With Address" value={progress.withAddress} color="text-blue-400" subtitle={`${(progress.withAddress/progress.total*100).toFixed(1)}%`} />
          <StatCard label="Need Hospital" value={progress.needsHospital} color="text-amber-400" subtitle={`${(progress.needsHospital/progress.total*100).toFixed(1)}%`} />
        </div>
      )}

      {/* Division Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-zinc-500 mr-1" />
        {divisions.map(div => (
          <button
            key={div.key}
            onClick={() => { setSelectedDivision(div.key); setOffset(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedDivision === div.key
                ? 'text-white'
                : 'text-zinc-400 hover:text-white bg-white/5'
            }`}
            style={selectedDivision === div.key ? { backgroundColor: div.color + '20', color: div.color, border: `1px solid ${div.color}40` } : {}}
          >
            {div.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Contact List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              {currentDiv?.label} - Need Enrichment
            </h2>
            <span className="text-xs text-zinc-500">{total.toLocaleString()} contacts</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          ) : targets.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <UserCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm">All contacts enriched!</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {targets.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setEditingContact(contact)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      editingContact?.id === contact.id
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-[#111118] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: (currentDiv?.color || '#6b7280') + '20', border: `1.5px solid ${currentDiv?.color || '#6b7280'}40` }}
                      >
                        {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{contact.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {contact.district || 'Unknown'}
                          </span>
                          {contact.phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {contact.phone.slice(-10)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {!contact.hospital && (
                            <Badge className="text-[8px] bg-red-500/10 text-red-400 border-0 px-1 py-0">No Hospital</Badge>
                          )}
                          {!contact.specialty && (
                            <Badge className="text-[8px] bg-amber-500/10 text-amber-400 border-0 px-1 py-0">No Specialty</Badge>
                          )}
                          {!contact.address && (
                            <Badge className="text-[8px] bg-blue-500/10 text-blue-400 border-0 px-1 py-0">No Address</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="ghost" className="text-zinc-400" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <span className="text-xs text-zinc-500">
                  {offset + 1}-{Math.min(offset + limit, total)} of {total.toLocaleString()}
                </span>
                <Button size="sm" variant="ghost" className="text-zinc-400" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Right: Enrichment Panel */}
        <div>
          {editingContact ? (
            <EnrichmentPanel 
              contact={editingContact} 
              onSave={(data) => enrichMutation.mutate({ contactId: editingContact.id, ...data })}
              isSaving={enrichMutation.isPending}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-20">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Select a contact to start enriching</p>
              <p className="text-xs text-zinc-600 mt-1">Click any contact from the list</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, subtitle }: { label: string; value: number; color: string; subtitle?: string }) {
  return (
    <Card className="bg-[#111118] border-white/5">
      <CardContent className="p-3">
        <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
        {subtitle && <p className="text-[10px] text-zinc-600">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function EnrichmentPanel({ contact, onSave, isSaving }: { contact: any; onSave: (data: any) => void; isSaving: boolean }) {
  const [hospital, setHospital] = useState(contact.hospital || '');
  const [address, setAddress] = useState(contact.address || '');
  const [specialty, setSpecialty] = useState(contact.specialty || '');
  const [designation, setDesignation] = useState(contact.designation || '');
  const [source, setSource] = useState('');

  const city = contact.district || 'India';

  const searchLinks = [
    { name: 'Practo', color: '#0ea5e9', url: `https://www.practo.com/search/doctors?results_type=doctor&q=${encodeURIComponent(contact.name + ' ' + (contact.specialty || ''))}&city=${encodeURIComponent(city)}` },
    { name: 'Google', color: '#ef4444', url: `https://www.google.com/search?q=${encodeURIComponent(contact.name + ' doctor ' + (contact.specialty || '') + ' ' + city + ' hospital')}` },
    { name: 'Justdial', color: '#f97316', url: `https://www.justdial.com/${encodeURIComponent(city)}/search?q=${encodeURIComponent(contact.name + ' doctor')}` },
    { name: 'Lybrate', color: '#8b5cf6', url: `https://www.lybrate.com/search?q=${encodeURIComponent(contact.name)}&city=${encodeURIComponent(city)}&search_type=doctor` },
    { name: 'Apollo', color: '#06b6d4', url: `https://www.apollohospitals.com/doctors/?search=${encodeURIComponent(contact.name)}` },
    { name: 'G-Maps', color: '#10b981', url: `https://www.google.com/maps/search/${encodeURIComponent(contact.name + ' doctor clinic ' + city)}` },
  ];

  return (
    <div className="space-y-3">
      {/* Contact Header */}
      <Card className="bg-[#111118] border-white/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sm font-bold text-sky-400 flex-shrink-0">
              {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{contact.name}</h3>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {contact.district || 'Unknown'}
                {contact.phone && <span className="ml-2 flex items-center gap-0.5"><Phone className="w-3 h-3" /> {contact.phone}</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Links */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> Search Online
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {searchLinks.map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: link.color + '12', color: link.color, border: `1px solid ${link.color}25` }}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {link.name}
              </a>
            ))}
          </div>
          <p className="text-[9px] text-zinc-600 mt-1.5">Opens in new tab. Find hospital/address then fill below.</p>
        </CardContent>
      </Card>

      {/* Enrichment Form */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Update Contact Info
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2.5">
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Hospital / Clinic Name</label>
            <Input 
              value={hospital} 
              onChange={e => setHospital(e.target.value)}
              placeholder="e.g., Apollo Hospitals, Jubilee Hills"
              className="h-8 bg-white/5 border-white/10 text-white text-xs placeholder:text-zinc-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Full Address</label>
            <Input 
              value={address} 
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g., Road No. 72, Jubilee Hills, Hyderabad - 500033"
              className="h-8 bg-white/5 border-white/10 text-white text-xs placeholder:text-zinc-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 mb-0.5 block">Specialty</label>
              <Input 
                value={specialty} 
                onChange={e => setSpecialty(e.target.value)}
                placeholder="e.g., Obstetrics & Gynecology"
                className="h-8 bg-white/5 border-white/10 text-white text-xs placeholder:text-zinc-700"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-0.5 block">Designation</label>
              <Input 
                value={designation} 
                onChange={e => setDesignation(e.target.value)}
                placeholder="e.g., Senior Consultant"
                className="h-8 bg-white/5 border-white/10 text-white text-xs placeholder:text-zinc-700"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Data Source</label>
            <div className="flex gap-1.5 flex-wrap">
              {['Practo', 'Google', 'Justdial', 'Lybrate', 'Apollo', 'Field Visit', 'Other'].map(src => (
                <button
                  key={src}
                  onClick={() => setSource(src)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                    source === src 
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                      : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-zinc-300'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full h-8 bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-medium mt-1"
            disabled={isSaving || (!hospital && !address && !specialty && !designation)}
            onClick={() => onSave({ hospital, address, specialty, designation, source })}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Star className="w-3.5 h-3.5 mr-1" />}
            {isSaving ? 'Saving...' : 'Save Enrichment'}
          </Button>
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
        <p className="text-[10px] text-amber-400 font-medium mb-1">Pro Tips:</p>
        <ul className="text-[9px] text-zinc-500 space-y-0.5">
          <li>1. Click Practo first - most accurate doctor data</li>
          <li>2. Check Google Maps for exact pincode/address</li>
          <li>3. Use Justdial for phone verification</li>
          <li>4. Apollo link finds doctors at Apollo hospitals</li>
          <li>5. Fill hospital name exactly as it appears online</li>
        </ul>
      </div>
    </div>
  );
}
