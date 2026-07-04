import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/providers/trpc';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, Target, Activity, Users } from 'lucide-react';

const divColors: Record<string, string> = {
  'Trauma & Fracture': '#ef4444', 'Arthroplasty': '#f59e0b', 'Cardiovascular': '#ec4899',
  'Endo-Surgery': '#8b5cf6', 'Neuro & Spine': '#06b6d4', 'Gynecology': '#10b981',
  'Diagnostics': '#6366f1', 'Consumables': '#84cc16',
};

export function Analytics() {
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: trends } = trpc.dashboard.trends.useQuery();

  if (!stats) return <div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Contacts', value: stats.contacts.total, icon: Users, color: '#3b82f6' },
          { title: 'Active Leads', value: stats.leads.active, icon: Target, color: '#f59e0b' },
          { title: 'Win Rate', value: stats.leads.total > 0 ? `${Math.round((stats.leads.won / stats.leads.total) * 100)}%` : '0%', icon: TrendingUp, color: '#10b981' },
          { title: 'Activities', value: stats.recentActivities.length, icon: Activity, color: '#8b5cf6' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-[#111118] border-white/5">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${card.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{card.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white">Monthly Trends</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends || []}>
                <defs>
                  <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#c1)" strokeWidth={2} />
                <Area type="monotone" dataKey="leads" stroke="#3b82f6" fill="url(#c2)" strokeWidth={2} />
                <Bar dataKey="activities" fill="#10b981" radius={[4,4,0,0]} barSize={12} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white">Division Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.divisions} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="division" label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}>
                  {stats.divisions.map((d: any, i: number) => <Cell key={i} fill={divColors[d.division] || '#52525b'} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white">Lead Sources</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { source: 'Field Visit', count: 45, color: '#10b981' },
              { source: 'Referrals', count: 32, color: '#3b82f6' },
              { source: 'Exhibitions', count: 18, color: '#f59e0b' },
              { source: 'Cold Calls', count: 15, color: '#8b5cf6' },
              { source: 'Tenders', count: 12, color: '#ec4899' },
              { source: 'Website', count: 8, color: '#06b6d4' },
              { source: 'Scraping', count: 25, color: '#22c55e' },
              { source: 'Imports', count: 14, color: '#6366f1' },
            ].map((s) => (
              <div key={s.source} className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-zinc-400">{s.source}</span>
                </div>
                <p className="text-xl font-bold text-white">{s.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
