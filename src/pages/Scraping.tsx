import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/providers/trpc';
import { Globe, CheckCircle2, AlertCircle, Clock, Play, Database } from 'lucide-react';

export function Scraping() {
  const { data: jobs, refetch } = trpc.scraper.jobs.useQuery();
  const { data: stats } = trpc.scraper.stats.useQuery();
  const scrapeOBG = trpc.scraper.scrapeOBGTelangana.useMutation({ onSuccess: () => refetch() });

  const runScraper = (target: string) => {
    if (target === 'obg') {
      scrapeOBG.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111118] border-white/5"><CardContent className="p-4 text-center"><Database className="w-6 h-6 text-blue-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{stats?.totalJobs || 0}</p><p className="text-[10px] text-zinc-500">Total Jobs</p></CardContent></Card>
        <Card className="bg-[#111118] border-white/5"><CardContent className="p-4 text-center"><CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{stats?.completedJobs || 0}</p><p className="text-[10px] text-zinc-500">Completed</p></CardContent></Card>
        <Card className="bg-[#111118] border-white/5"><CardContent className="p-4 text-center"><Globe className="w-6 h-6 text-amber-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{stats?.totalRecordsScraped || 0}</p><p className="text-[10px] text-zinc-500">Records Scraped</p></CardContent></Card>
      </div>

      {/* Scraper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: 'obg', title: 'OBG Telangana', desc: 'Scrape OBG doctors across all 33 Telangana districts', source: 'justdial', icon: Globe, color: '#ec4899' },
          { id: 'ortho', title: 'Orthopedic Surgeons', desc: 'Orthopedic surgeons in Hyderabad & major cities', source: 'practo', icon: Globe, color: '#f59e0b' },
          { id: 'cardio', title: 'Cardiologists', desc: 'Cardiologists and CV surgeons in Telangana', source: 'google_maps', icon: Globe, color: '#ef4444' },
          { id: 'hospitals', title: 'Hospital Directory', desc: 'Hospitals and clinics across all districts', source: 'hospital_site', icon: Globe, color: '#3b82f6' },
        ].map((scraper) => {
          const Icon = scraper.icon;
          return (
            <Card key={scraper.id} className="bg-[#111118] border-white/5 hover:border-white/10 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${scraper.color}15` }}>
                    <Icon className="w-6 h-6" style={{ color: scraper.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">{scraper.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{scraper.desc}</p>
                    <Badge variant="outline" className="mt-2 text-[9px] bg-white/5 text-zinc-400 border-white/10">{scraper.source}</Badge>
                  </div>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black flex-shrink-0" onClick={() => runScraper(scraper.id)} disabled={scrapeOBG.isPending}>
                    <Play className="w-3 h-3 mr-1" /> {scrapeOBG.isPending ? 'Running...' : 'Run'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Jobs History */}
      <Card className="bg-[#111118] border-white/5">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Scraping Jobs</h3>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {(jobs?.items || []).map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : job.status === 'running' ? <Clock className="w-4 h-4 text-amber-400 animate-spin" /> : <AlertCircle className="w-4 h-4 text-zinc-500" />}
                    <div>
                      <p className="text-xs font-medium text-zinc-300 capitalize">{job.target} {job.specialty ? `· ${job.specialty}` : ''}</p>
                      <p className="text-[10px] text-zinc-500">{job.city || 'All cities'} · {new Date(job.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-[9px] ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : job.status === 'running' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-500/10 text-zinc-400'}`}>{job.status}</Badge>
                    {job.recordsFound !== null && <p className="text-[10px] text-zinc-500 mt-1">{job.recordsAdded} / {job.recordsFound} added</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
