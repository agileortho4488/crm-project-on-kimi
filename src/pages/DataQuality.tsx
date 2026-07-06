import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/providers/trpc';
import {
  Sparkles, BarChart3, Users, MapPin, Building2, Phone, Mail,
  Award, AlertTriangle, CheckCircle2, Loader2, Stethoscope,
  Heart, Bone, Brain, Activity, Microscope, Package, Syringe,
  Baby, RefreshCw
} from 'lucide-react';

const DIVISION_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  trauma_fracture: { label: 'Trauma & Fracture', icon: Bone, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  arthroplasty: { label: 'Arthroplasty', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  cardiovascular: { label: 'Cardiovascular', icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
  endo_surgery: { label: 'Endo-Surgery', icon: Syringe, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  neuro_spine: { label: 'Neuro & Spine', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  gynecology: { label: 'Gynecology', icon: Baby, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  diagnostics: { label: 'Diagnostics', icon: Microscope, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  consumables: { label: 'Consumables', icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  unknown: { label: 'Unclassified', icon: AlertTriangle, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
};

export function DataQuality() {
  const [lastEnriched, setLastEnriched] = useState<Date | null>(null);
  
  const { data: stats, refetch, isLoading } = trpc.enrichment.stats.useQuery(undefined, {
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
  const enrichMutation = trpc.enrichment.enrichAll.useMutation({
    onSuccess: () => { setLastEnriched(new Date()); refetch(); },
  });
  
  // New batch enrich for division/type/specialty
  const batchEnrichMutation = trpc.contact.batchEnrich.useMutation({
    onSuccess: (data) => { setLastEnriched(new Date()); refetch(); alert(`Enriched ${data.updated} contacts! Division: ${data.breakdown.division}, Type: ${data.breakdown.type}, Specialty: ${data.breakdown.specialty}, Quality: ${data.breakdown.quality}`); },
  });
  
  const { data: enrichProgress } = trpc.contact.enrichmentStats.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const qualityPercentage = stats?.total ? Math.round((stats.highQuality / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Data Quality Center</h1>
          <p className="text-sm text-zinc-500">
            {isLoading ? 'Loading stats...' : 
             lastEnriched ? `Last enriched: ${lastEnriched.toLocaleTimeString()}` : 
             'Auto-enrichment runs after every import'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
            <Sparkles className="w-3 h-3 mr-1" /> Auto-Enrichment Active
          </Badge>
          <Button
            onClick={() => { batchEnrichMutation.mutate({ limit: 5000, classifyDivision: true, classifyType: true, inferSpecialty: true, recalculateQuality: true }); }}
            disabled={batchEnrichMutation.isPending}
            size="sm"
            className="bg-amber-500 text-black hover:bg-amber-400 mr-2"
          >
            {batchEnrichMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            {batchEnrichMutation.isPending ? 'Enriching...' : 'Batch Enrich All'}
          </Button>
          <Button
            onClick={() => { enrichMutation.mutate(); refetch(); }}
            disabled={enrichMutation.isPending}
            variant="outline"
            size="sm"
            className="border-white/10 text-zinc-400 hover:text-white"
          >
            {enrichMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                <p className="text-xs text-zinc-500">Total Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Award className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats?.highQuality || 0}</p>
                <p className="text-xs text-zinc-500">High Quality (70+)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MapPin className="w-5 h-5 text-amber-400" /></div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{Object.keys(stats?.byDistrict || {}).length}</p>
                <p className="text-xs text-zinc-500">Districts Covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{stats?.avgQualityScore || 0}%</p>
                <p className="text-xs text-zinc-500">Avg Quality Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Score Distribution */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Quality Score Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400">High Quality (70-100)</span>
                <span className="text-white font-medium">{stats?.highQuality || 0}</span>
              </div>
              <Progress value={stats?.total ? (stats.highQuality / stats.total) * 100 : 0} className="h-2 bg-white/5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-amber-400">Medium (40-69)</span>
                <span className="text-white font-medium">{stats?.mediumQuality || 0}</span>
              </div>
              <Progress value={stats?.total ? (stats.mediumQuality / stats.total) * 100 : 0} className="h-2 bg-white/5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Low (0-39)</span>
                <span className="text-white font-medium">{stats?.lowQuality || 0}</span>
              </div>
              <Progress value={stats?.total ? (stats.lowQuality / stats.total) * 100 : 0} className="h-2 bg-white/5" />
            </div>
            <div className="pt-2 flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${qualityPercentage >= 60 ? 'text-emerald-400' : qualityPercentage >= 30 ? 'text-amber-400' : 'text-red-400'}`} />
              <span className="text-xs text-zinc-400">{qualityPercentage}% contacts are high quality</span>
            </div>
          </CardContent>
        </Card>

        {/* Field Completeness */}
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Field Completeness</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Phone Number', count: stats?.withPhone || 0, total: stats?.total || 0, icon: Phone },
              { label: 'District', count: stats?.withDistrict || 0, total: stats?.total || 0, icon: MapPin },
              { label: 'Hospital/Clinic', count: stats?.withHospital || 0, total: stats?.total || 0, icon: Building2 },
              { label: 'Division', count: stats?.withDivision || 0, total: stats?.total || 0, icon: Award },
              { label: 'Email', count: stats?.withEmail || 0, total: stats?.total || 0, icon: Mail },
            ].map((field) => {
              const pct = field.total > 0 ? Math.round((field.count / field.total) * 100) : 0;
              const Icon = field.icon;
              return (
                <div key={field.label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-zinc-500" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{field.label}</span>
                      <span className="text-white">{field.count}/{field.total} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-1.5 bg-white/5" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Division Breakdown */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400 flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Contacts by Division</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(DIVISION_CONFIG).map(([key, config]) => {
              const count = stats?.byDivision?.[key] || 0;
              const percentage = stats?.total ? Math.round((count / stats.total) * 100) : 0;
              const Icon = config.icon;
              return (
                <div key={key} className={`p-3 rounded-lg ${config.bg} border border-white/5`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs font-medium text-zinc-300">{config.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${config.color}`}>{count}</p>
                  <p className="text-[10px] text-zinc-500">{percentage}% of total</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contact Type Distribution */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Contact Types</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <Badge key={type} variant="outline" className="bg-white/[0.02] text-zinc-400 border-white/10 capitalize">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* District Breakdown */}
      {stats?.byDistrict && Object.keys(stats.byDistrict).length > 0 && (
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400 flex items-center gap-2"><MapPin className="w-4 h-4" /> Top Districts</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(stats.byDistrict)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 18)
                .map(([district, count]) => (
                  <div key={district} className="p-2 rounded bg-white/[0.02] text-center">
                    <p className="text-xs font-medium text-zinc-300">{district}</p>
                    <p className="text-xs text-zinc-500">{count as number}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
