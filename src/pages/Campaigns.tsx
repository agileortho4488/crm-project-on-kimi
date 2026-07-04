import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/providers/trpc';
import { districts } from '@/types';
import { Megaphone, Phone, MessageCircle, Download, RefreshCw, Users, MapPin, Send, Loader2, Sparkles } from 'lucide-react';

const DEFAULT_MESSAGE = `Dear Doctor,

I am Dr. Pramod Tapadia from Agile Ortho Surgical Hub — Master Franchisee Distributor of Meril Life Sciences for Telangana.

I am excited to introduce you to Meril's **Intrauterine Tamponade** — a breakthrough device for managing *postpartum hemorrhage and premature bleeding in pregnancy*.

Key Benefits:
- Rapid control of intrauterine bleeding
- Easy insertion & removal
- Cost-effective alternative to surgery
- Proven clinical outcomes

Can we schedule a brief product demonstration at your convenience? I would be happy to visit your hospital/clinic.

Best regards,
Dr. Pramod Tapadia
Agile Ortho Surgical Hub
Meril Life Sciences - Telangana
Phone: +91-98490-XXXXX`;

export function Campaigns() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [campaignMessage, setCampaignMessage] = useState(DEFAULT_MESSAGE);
  const [productName, setProductName] = useState('Intrauterine Tamponade');
  const [campaignName, setCampaignName] = useState('IUT-Pregnancy-Bleeding-July2026');

  const { data: stats, refetch: refetchStats } = trpc.campaign.campaignStats.useQuery();
  const { data: obgData, refetch: refetchOBG } = trpc.campaign.getOBGForWhatsApp.useQuery(
    { district: selectedDistrict === 'all' ? undefined : selectedDistrict, limit: 500 }
  );
  const { data: waLinks } = trpc.campaign.generateWhatsAppLinks.useQuery(
    { message: campaignMessage, productName, district: selectedDistrict === 'all' ? undefined : selectedDistrict, limit: 500 },
    { enabled: activeTab === 'whatsapp' }
  );

  const cleanMutation = trpc.campaign.cleanMobiles.useMutation({
    onSuccess: () => { refetchStats(); refetchOBG(); }
  });



  const obgContacts = obgData?.items || [];
  const links = waLinks?.links || [];

  // Export as CSV
  const exportCSV = () => {
    if (!links.length) return;
    const headers = ['Name', 'Mobile', 'District', 'Hospital/Clinic', 'WhatsApp Link'];
    const rows = links.map(l => [l.name, l.mobile, l.district, l.hospital, l.waLink]);
    const csv = [headers, ...rows].map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OBG-Campaign-${campaignName}-${selectedDistrict}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export mobile numbers only (for bulk WhatsApp tools)
  const exportMobilesOnly = () => {
    const mobiles = links.map((l: any) => l.mobile).join('\n');
    const blob = new Blob([mobiles], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobiles-${campaignName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 text-pink-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats?.obgTotal || 0}</p>
            <p className="text-[10px] text-zinc-500">OBG Contacts</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <Phone className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats?.obgWithMobile || 0}</p>
            <p className="text-[10px] text-zinc-500">With Mobile</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <Megaphone className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats?.campaignsRun || 0}</p>
            <p className="text-[10px] text-zinc-500">Campaigns Sent</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <Sparkles className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats?.totalWithMobile || 0}</p>
            <p className="text-[10px] text-zinc-500">Total Mobiles in DB</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-3">
        <Button 
          size="sm" 
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
          onClick={() => cleanMutation.mutate()}
          disabled={cleanMutation.isPending}
        >
          {cleanMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Clean All Mobiles
        </Button>
        <select 
          value={selectedDistrict} 
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 px-2 py-1.5 outline-none"
        >
          <option value="all">All Districts</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex-1" />
        <p className="text-xs text-zinc-500">{obgContacts.length} OBG contacts loaded</p>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-[#111118] border border-white/5 w-auto">
          <TabsTrigger value="contacts" className="text-xs data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-400">OBG Contacts</TabsTrigger>
          <TabsTrigger value="message" className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">Campaign Message</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">WhatsApp Links</TabsTrigger>
        </TabsList>

        {/* Tab 1: OBG Contacts */}
        {activeTab === 'contacts' && (
          <div className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-2">
                {obgContacts.map((contact: any) => (
                  <Card key={contact.id} className="bg-[#111118] border-white/5 hover:border-pink-500/30 transition-all">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-pink-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                            {contact.specialty && (
                              <Badge variant="outline" className="text-[9px] bg-pink-500/10 text-pink-400 border-pink-500/20">{contact.specialty}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            {contact.cleanMobile && (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <Phone className="w-3 h-3" /> {contact.cleanMobile}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <MapPin className="w-3 h-3" /> {contact.district || 'Unknown'}
                            </span>
                          </div>
                          {contact.hospital && (
                            <p className="text-[10px] text-zinc-600 mt-1">{contact.hospital}</p>
                          )}
                        </div>
                        {contact.cleanMobile && (
                          <a 
                            href={`https://wa.me/${contact.cleanMobile.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-400" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {obgContacts.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">No OBG contacts found</p>
                    <p className="text-xs text-zinc-600 mt-1">Upload OBG doctor data or run the scraper</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Tab 2: Campaign Message */}
        {activeTab === 'message' && (
          <div className="flex-1 min-h-0 mt-3 space-y-3 overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Campaign Name</label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="bg-white/5 border-white/10 text-sm" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Product</label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} className="bg-white/5 border-white/10 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">WhatsApp Message</label>
              <Textarea 
                value={campaignMessage} 
                onChange={(e) => setCampaignMessage(e.target.value)} 
                className="bg-white/5 border-white/10 text-sm min-h-[300px] font-mono leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">{campaignMessage.length} characters · ~{Math.ceil(campaignMessage.length / 160)} SMS segments</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-white/10 text-zinc-400" onClick={() => setCampaignMessage(DEFAULT_MESSAGE)}>Reset Default</Button>
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold" onClick={() => setActiveTab('whatsapp')}>
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Generate Links
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: WhatsApp Links */}
        {activeTab === 'whatsapp' && (
          <div className="flex-1 min-h-0 mt-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold" onClick={exportCSV}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 text-zinc-400" onClick={exportMobilesOnly}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Mobiles Only
                </Button>
              </div>
              <p className="text-xs text-zinc-500">{links.length} WhatsApp links ready</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {links.map((link: any, i: number) => (
                  <Card key={i} className="bg-[#111118] border-white/5 hover:border-emerald-500/30 transition-all">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-600 w-6 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{link.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-emerald-400">{link.mobile}</span>
                            <span className="text-[10px] text-zinc-500">{link.district}</span>
                            {link.hospital && <span className="text-[10px] text-zinc-600 truncate">{link.hospital}</span>}
                          </div>
                        </div>
                        <a 
                          href={link.waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">Open WA</span>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {links.length === 0 && (
                  <div className="text-center py-12">
                    <MessageCircle className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">No WhatsApp links generated yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Switch to Message tab and generate</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </Tabs>
    </div>
  );
}
