import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/providers/trpc';
import { Users, Target, TrendingUp, AlertCircle, MapPin, Activity, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import type { AppPage } from '@/types';

interface DashboardProps { onNavigate: (page: AppPage) => void; }

const divColors: Record<string, string> = {
  'Trauma & Fracture': '#ef4444', 'Arthroplasty': '#f59e0b', 'Cardiovascular': '#ec4899',
  'Endo-Surgery': '#8b5cf6', 'Neuro & Spine': '#06b6d4', 'Gynecology': '#10b981',
  'Diagnostics': '#6366f1', 'Consumables': '#84cc16',
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: trends } = trpc.dashboard.trends.useQuery();

  if (!stats) return <div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>;

  const kpiCards = [
    { title: 'Total Contacts', value: stats.contacts.total, sub: `${stats.contacts.doctors} Doctors · ${stats.contacts.hospitals} Hospitals`, icon: Users, color: '#3b82f6', page: 'contacts' as AppPage },
    { title: 'Active Leads', value: stats.leads.active, sub: `${stats.leads.won} closed this month`, icon: Target, color: '#f59e0b', page: 'leads' as AppPage },
    { title: 'Pending Tasks', value: stats.tasks.pending + stats.tasks.overdue, sub: `${stats.tasks.overdue} overdue`, icon: AlertCircle, color: '#ef4444', page: 'tasks' as AppPage },
    { title: 'District Coverage', value: `${stats.districts}/33`, sub: 'Telangana districts', icon: MapPin, color: '#8b5cf6', page: 'contacts' as AppPage },
    { title: 'Products', value: stats.products, sub: 'Active products', icon: TrendingUp, color: '#10b981', page: 'products' as AppPage },
    { title: 'Scraping Jobs', value: stats.scrapingJobs, sub: 'Data collection runs', icon: Activity, color: '#06b6d4', page: 'scraping' as AppPage },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="bg-[#111118] border-white/5 hover:border-white/10 transition-all cursor-pointer" onClick={() => onNavigate(kpi.page)}>
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${kpi.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <p className="text-2xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{kpi.title}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white">Revenue & Leads Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trends || []}>
                <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v/100000}L`} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#colorRev)" strokeWidth={2} />
                <Bar dataKey="leads" fill="#3b82f6" radius={[4,4,0,0]} barSize={20} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white">Division Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={stats.divisions} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="division">
                {stats.divisions.map((d: any, i: number) => <Cell key={i} fill={divColors[d.division] || '#52525b'} />)}
              </Pie><Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} /></PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {stats.divisions.slice(0, 4).map((d: any) => (
                <div key={d.division} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: divColors[d.division] }} /><span className="text-[10px] text-zinc-400 truncate">{d.division}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Recent Activities</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.recentActivities.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0"><Activity className="w-3.5 h-3.5 text-blue-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{a.description}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{a.type} · {new Date(a.createdAt).toLocaleDateString()}</p>
                  {a.outcome && <Badge variant="outline" className="mt-1 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{a.outcome}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-purple-400" /> Sales Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.leads.pipeline.map((p: any) => (
              <div key={p.stage}>
                <div className="flex items-center justify-between mb-1"><span className="text-xs text-zinc-400 capitalize">{p.stage.replace('_', ' ')}</span><span className="text-xs font-medium text-white">{p.count}</span></div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min((p.count / Math.max(stats.leads.total, 1)) * 100 * 5, 100)}%`, backgroundColor: divColors[p.stage] || '#f59e0b' }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <button onClick={() => onNavigate('imports')} className="w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left hover:bg-amber-500/20 transition-colors">
              <p className="text-sm font-medium text-amber-400">Import Data</p>
              <p className="text-[10px] text-zinc-500">Upload Excel, CSV, or PDF files</p>
            </button>
            <button onClick={() => onNavigate('scraping')} className="w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/20 transition-colors">
              <p className="text-sm font-medium text-blue-400">Run Scraper</p>
              <p className="text-[10px] text-zinc-500">Collect data from online sources</p>
            </button>
            <button onClick={() => onNavigate('contacts')} className="w-full p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-left hover:bg-emerald-500/20 transition-colors">
              <p className="text-sm font-medium text-emerald-400">View Contacts</p>
              <p className="text-[10px] text-zinc-500">Browse {stats.contacts.total} contacts</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
