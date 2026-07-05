import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/providers/trpc';
import {
  Wand2, AlertTriangle, CheckCircle2, ExternalLink, Loader2,
  Phone, MapPin, Stethoscope, Building2, Mail, Zap, Brain,
  TrendingUp, ArrowRight, Search
} from 'lucide-react';

export function EnrichmentHub() {
  const { data: summary, refetch: refetchSummary } = trpc.smartEnrichment.summary.useQuery();
  const { data: lowQuality, refetch: refetchLowQuality } = trpc.smartEnrichment.getLowQuality.useQuery({ limit: 50, maxScore: 50 });

  const autoFixMutation = trpc.smartEnrichment.autoFix.useMutation({
    onSuccess: () => {
      refetchSummary();
      refetchLowQuality();
    },
  });

  const confidenceColor = (c: string) => c === 'high' ? 'text-emerald-400 bg-emerald-500/10' : c === 'medium' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-400" /> Smart Enrichment Hub
        </h1>
        <p className="text-sm text-zinc-500">AI-powered data filling — turn incomplete contacts into campaign-ready leads</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-white">{summary?.total || 0}</p>
            <p className="text-[10px] text-zinc-500">Total Contacts</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-emerald-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{summary?.highQuality || 0}</p>
            <p className="text-[10px] text-zinc-500">High Quality</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-amber-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{summary?.mediumQuality || 0}</p>
            <p className="text-[10px] text-zinc-500">Medium</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-red-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{summary?.lowQuality || 0}</p>
            <p className="text-[10px] text-zinc-500">Low Quality</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{summary?.fixable || 0}</p>
            <p className="text-[10px] text-zinc-500">Auto-Fixable</p>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400 flex items-center gap-2"><Brain className="w-4 h-4" /> 5-Layer Enrichment Engine</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Phone, label: 'Phone Prefix', desc: 'Maps mobile prefix to district', color: 'text-blue-400' },
              { icon: Stethoscope, label: 'Name Patterns', desc: 'Infers specialty from name', color: 'text-purple-400' },
              { icon: Building2, label: 'Hospital Type', desc: 'Hospital name → specialty', color: 'text-emerald-400' },
              { icon: Search, label: 'Web Search', desc: 'JustDial/Practo/Google links', color: 'text-amber-400' },
              { icon: Mail, label: 'Email Pattern', desc: 'Generates probable email', color: 'text-pink-400' },
            ].map((layer) => (
              <div key={layer.label} className="text-center p-3 rounded-lg bg-white/[0.02]">
                <layer.icon className={`w-5 h-5 ${layer.color} mx-auto mb-2`} />
                <p className="text-xs font-medium text-zinc-300">{layer.label}</p>
                <p className="text-[10px] text-zinc-500">{layer.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-zinc-300">Bulk Auto-Fix Available</p>
            <p className="text-xs text-zinc-500">{summary?.fixable || 0} contacts can be improved with high-confidence suggestions</p>
          </div>
        </div>
        <Button
          onClick={() => {
            lowQuality?.contacts.forEach(c => {
              if (c.suggestions.some(s => s.confidence === 'high')) {
                autoFixMutation.mutate({ contactId: c.id, applyHighConfidenceOnly: true });
              }
            });
          }}
          disabled={autoFixMutation.isPending}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {autoFixMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          Auto-Fix All High-Confidence
        </Button>
      </div>

      {/* Low Quality Contacts with Suggestions */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Contacts Needing Enrichment ({lowQuality?.contacts.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {(lowQuality?.contacts || []).length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">All contacts are well-enriched!</p>
                </div>
              )}
              {lowQuality?.contacts.map((contact) => (
                <div key={contact.id} className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                  {/* Contact Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${contact.currentScore < 30 ? 'bg-red-500/10 text-red-400' : contact.currentScore < 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {contact.currentScore}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{contact.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                          {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>}
                          {contact.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {contact.district}</span>}
                          {contact.specialty && <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {contact.specialty}</span>}
                          {contact.hospital && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {contact.hospital}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <TrendingUp className="w-3 h-3 mr-1" /> → {contact.potentialScore}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => autoFixMutation.mutate({ contactId: contact.id })}
                        disabled={autoFixMutation.isPending}
                      >
                        <Zap className="w-3 h-3 mr-1" /> Auto-Fix
                      </Button>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {contact.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">AI Suggestions</p>
                      {contact.suggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-white/[0.01]">
                          <Badge className={`text-[9px] ${confidenceColor(s.confidence)}`}>{s.confidence}</Badge>
                          <span className="text-xs text-zinc-400">{s.source}:</span>
                          <span className="text-xs text-zinc-300">{s.field}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-600" />
                          <span className="text-xs font-medium text-emerald-400">{s.suggestedValue}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Links */}
                  {contact.searchUrls && (
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-[10px] text-zinc-500 mr-2">Research:</p>
                      {(() => {
                        try {
                          const urls = JSON.parse(contact.searchUrls);
                          return (
                            <>
                              <a href={urls.justdial} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3 h-3" /> JustDial
                              </a>
                              <a href={urls.practo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3 h-3" /> Practo
                              </a>
                              <a href={urls.google} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3 h-3" /> Google
                              </a>
                            </>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
