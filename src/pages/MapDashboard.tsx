import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/providers/trpc';
import { MapPin, Users, Filter, BarChart3, Stethoscope, Loader2 } from 'lucide-react';

// City coordinates for India
const CITY_COORDS: Record<string, [number, number]> = {
  'Hyderabad': [17.385, 78.4867], 'Secunderabad': [17.4399, 78.4983],
  'Vijayawada': [16.5062, 80.648], 'Tirupati': [13.6288, 79.4192],
  'Guntur': [16.3067, 80.4365], 'Nellore': [14.4426, 79.9865],
  'Kurnool': [15.8281, 78.0373], 'Kakinada': [16.9891, 82.2475],
  'Warangal': [17.9689, 79.5941], 'Rajahmundry': [17.0005, 81.804],
  'Kadapa': [14.4673, 78.8242], 'Srikakulam': [18.2965, 83.8965],
  'Bangalore': [12.9716, 77.5946], 'Mumbai': [19.076, 72.8777],
  'Delhi': [28.6139, 77.209], 'Chennai': [13.0827, 80.2707],
  'Pune': [18.5204, 73.8567], 'Nagpur': [21.1458, 79.0882],
  'Kolkata': [22.5726, 88.3639], 'Ahmedabad': [23.0225, 72.5714],
  'Jaipur': [26.9124, 75.7873], 'Lucknow': [26.8467, 80.9462],
  'Visakhapatnam': [17.6868, 83.2185], 'Kochi': [9.9312, 76.2673],
  'Mysore': [12.2958, 76.6394], 'Nashik': [19.9975, 73.7898],
  'Surat': [21.1702, 72.8311], 'Indore': [22.7196, 75.8577],
  'Bhopal': [23.2599, 77.4126], 'Patna': [25.5941, 85.1376],
  'Guwahati': [26.1445, 91.7362], 'Bhubaneswar': [20.2961, 85.8245],
  'Ludhiana': [30.901, 75.8573], 'Kanpur': [26.4499, 80.3319],
  'Varanasi': [25.3176, 82.9739], 'Agra': [27.1767, 78.0081],
  'Ranchi': [23.3441, 85.3096],
};

const STATE_COORDS: Record<string, [number, number]> = {
  'Telangana': [17.5, 79], 'Andhra Pradesh': [15.9, 79.7],
  'Karnataka': [15.3, 75.7], 'Maharashtra': [19.7, 75.9],
  'Tamil Nadu': [11.1, 78.6], 'Delhi': [28.6, 77.2],
  'Kerala': [10.8, 76.7], 'West Bengal': [22.6, 88.3],
  'Gujarat': [22.3, 71.6], 'Rajasthan': [27, 74],
  'Uttar Pradesh': [27, 80], 'Punjab': [31, 75],
  'Haryana': [29, 76], 'Madhya Pradesh': [23, 77],
  'Bihar': [25.6, 85.8], 'Odisha': [20.5, 84],
  'Assam': [26.2, 92.9], 'Chhattisgarh': [21.3, 82],
  'Jharkhand': [23.6, 85.3],
};

const DIVISION_COLORS: Record<string, string> = {
  gynecology: '#ec4899', trauma_fracture: '#f97316', cardiovascular: '#ef4444',
  endo_surgery: '#10b981', neuro_spine: '#8b5cf6', diagnostics: '#06b6d4',
  consumables: '#f59e0b', unknown: '#6b7280',
};

export function MapDashboard() {
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'state' | 'city'>('city');

  // Get contacts aggregated by city/state
  const { data: geoData, isLoading } = trpc.contact.geoAggregation.useQuery({
    state: selectedState === 'all' ? undefined : selectedState,
    division: selectedDivision === 'all' ? undefined : selectedDivision,
  });

  const stats = useMemo(() => {
    if (!geoData) return null;
    const total = geoData.reduce((s, d) => s + d.count, 0);
    const byDivision: Record<string, number> = {};
    for (const d of geoData) {
      byDivision[d.division || 'unknown'] = (byDivision[d.division || 'unknown'] || 0) + d.count;
    }
    return { total, byDivision };
  }, [geoData]);

  // Generate map SVG
  const renderMap = () => {
    if (!geoData || geoData.length === 0) return null;

    const points = geoData
      .map(d => {
        const coords = viewMode === 'city' ? CITY_COORDS[d.city] : STATE_COORDS[d.state];
        if (!coords) return null;
        return {
          x: ((coords[1] - 68) / (97 - 68)) * 100, // Longitude to %
          y: ((37 - coords[0]) / (37 - 8)) * 100,   // Latitude to % (inverted)
          count: d.count,
          name: viewMode === 'city' ? d.city : d.state,
          division: d.division || 'unknown',
        };
      })
      .filter(Boolean) as any[];

    const maxCount = Math.max(...points.map(p => p.count));

    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ background: '#0a0a12' }}>
        {/* India outline approximation */}
        <path
          d="M20,35 L25,25 L35,20 L50,18 L65,15 L75,20 L80,30 L85,40 L82,55 L75,65 L70,75 L65,85 L60,90 L55,88 L50,85 L45,80 L40,75 L35,70 L30,60 L25,50 Z"
          fill="none" stroke="#1e293b" strokeWidth="0.3"
        />
        {/* State boundaries */}
        <text x="50" y="5" textAnchor="middle" fill="#64748b" fontSize="3">INDIA - Contact Distribution Map</text>
        {/* Grid */}
        {[20, 40, 60, 80].map(x => <line key={`v${x}`} x1={x} y1="10" x2={x} y2="95" stroke="#1e293b" strokeWidth="0.1" strokeDasharray="1,1" />)}
        {[20, 40, 60, 80].map(y => <line key={`h${y}`} x1="10" y1={y} x2="90" y2={y} stroke="#1e293b" strokeWidth="0.1" strokeDasharray="1,1" />)}

        {/* Data points */}
        {points.map((p, i) => {
          const radius = Math.max(0.5, Math.min(4, (p.count / maxCount) * 4));
          const color = DIVISION_COLORS[p.division] || '#6b7280';
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={radius} fill={color} fillOpacity="0.7" stroke={color} strokeWidth="0.2">
                <title>{`${p.name}: ${p.count.toLocaleString()} contacts`}</title>
              </circle>
              {p.count > maxCount * 0.1 && (
                <text x={p.x} y={p.y - radius - 1} textAnchor="middle" fill="#94a3b8" fontSize="1.5">
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" /> Geographic Distribution
          </h1>
          <p className="text-sm text-zinc-500">1.25M contacts mapped across India</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400">
            <Users className="w-3 h-3 mr-1" /> {stats?.total?.toLocaleString() || 0} contacts
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="Telangana">Telangana (870K)</SelectItem>
            <SelectItem value="Andhra Pradesh">Andhra Pradesh (210K)</SelectItem>
            <SelectItem value="Karnataka">Karnataka (14K)</SelectItem>
            <SelectItem value="Maharashtra">Maharashtra (2K)</SelectItem>
            <SelectItem value="Delhi">Delhi (8K)</SelectItem>
            <SelectItem value="Kerala">Kerala (700)</SelectItem>
            <SelectItem value="West Bengal">West Bengal (300)</SelectItem>
            <SelectItem value="Gujarat">Gujarat (3K)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedDivision} onValueChange={setSelectedDivision}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <Stethoscope className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Divisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            <SelectItem value="gynecology">Gynecology (OBG)</SelectItem>
            <SelectItem value="trauma_fracture">Ortho/Trauma</SelectItem>
            <SelectItem value="cardiovascular">Cardiovascular</SelectItem>
            <SelectItem value="neuro_spine">Neuro/Spine</SelectItem>
            <SelectItem value="diagnostics">Diagnostics</SelectItem>
            <SelectItem value="consumables">Consumables</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button size="sm" variant={viewMode === 'city' ? 'default' : 'outline'} onClick={() => setViewMode('city')} className={viewMode === 'city' ? 'bg-amber-500 text-black' : 'border-white/10 text-zinc-400'}>
            Cities
          </Button>
          <Button size="sm" variant={viewMode === 'state' ? 'default' : 'outline'} onClick={() => setViewMode('state')} className={viewMode === 'state' ? 'bg-amber-500 text-black' : 'border-white/10 text-zinc-400'}>
            States
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          <Card className="bg-[#111118] border-white/5 h-[500px]">
            <CardContent className="p-0 h-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              ) : (
                renderMap()
              )}
            </CardContent>
          </Card>
        </div>

        {/* Legend & Stats */}
        <div className="space-y-3">
          <Card className="bg-[#111118] border-white/5">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-zinc-400">Division Colors</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(DIVISION_COLORS).map(([div, color]) => (
                <div key={div} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-zinc-400 capitalize">{div.replace('_', ' ')}</span>
                  <span className="text-xs text-zinc-500 ml-auto">{stats?.byDivision?.[div]?.toLocaleString() || 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#111118] border-white/5">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-zinc-400">Top Cities</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {geoData?.slice(0, 10).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{d.city || d.state}</span>
                  <span className="text-zinc-500">{d.count.toLocaleString()}</span>
                </div>
              )) || <p className="text-xs text-zinc-600">Loading...</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
