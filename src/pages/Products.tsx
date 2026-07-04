import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/providers/trpc';
import { divisionNames } from '@/types';
import { Package, Bone, HeartPulse, Sparkles, Microscope, BrainCircuit, Baby, Beaker, ShoppingCart, Tag, CheckCircle2 } from 'lucide-react';

const divIcons: Record<string, React.ElementType> = {
  'Trauma & Fracture': Bone, 'Arthroplasty': HeartPulse, 'Cardiovascular': Sparkles,
  'Endo-Surgery': Microscope, 'Neuro & Spine': BrainCircuit, 'Gynecology': Baby,
  'Diagnostics': Beaker, 'Consumables': ShoppingCart,
};

const divColors: Record<string, string> = {
  'Trauma & Fracture': '#ef4444', 'Arthroplasty': '#f59e0b', 'Cardiovascular': '#ec4899',
  'Endo-Surgery': '#8b5cf6', 'Neuro & Spine': '#06b6d4', 'Gynecology': '#10b981',
  'Diagnostics': '#6366f1', 'Consumables': '#84cc16',
};

export function Products() {
  const [activeDivision, setActiveDivision] = useState('all');
  const { data } = trpc.product.list.useQuery(activeDivision === 'all' ? {} : { division: activeDivision });
  const products = data?.items || [];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 pb-1 min-w-max">
          <button onClick={() => setActiveDivision('all')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeDivision === 'all' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-[#111118] text-zinc-400 border border-white/5 hover:text-white'}`}>
            <Package className="w-4 h-4" />All ({products.length})
          </button>
          {divisionNames.map((d) => {
            const Icon = divIcons[d] || Package;
            const count = products.filter((p) => p.division === d).length;
            return (
              <button key={d} onClick={() => setActiveDivision(d)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeDivision === d ? 'border' : 'bg-[#111118] text-zinc-400 border border-white/5 hover:text-white'}`} style={activeDivision === d ? { color: divColors[d], borderColor: `${divColors[d]}40`, backgroundColor: `${divColors[d]}10` } : undefined}>
                <Icon className="w-4 h-4" />{d} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
          {products.map((product) => {
            const Icon = divIcons[product.division || ''] || Package;
            const color = divColors[product.division || ''] || '#f59e0b';
            return (
              <Card key={product.id} className="bg-[#111118] border-white/5 hover:border-white/10 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />{product.status}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{product.name}</h3>
                  {product.code && <p className="text-[10px] text-zinc-500 font-mono">{product.code}</p>}
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{product.description}</p>
                  {product.specifications && <div className="mt-3 p-2.5 rounded-lg bg-white/[0.02]"><p className="text-[10px] text-zinc-500 mb-1">Specs</p><p className="text-xs text-zinc-300">{product.specifications}</p></div>}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div><p className="text-[10px] text-zinc-500">Price</p><p className="text-sm font-bold text-amber-400">₹{product.price?.toLocaleString() || 0}</p></div>
                    <Badge variant="outline" className="text-[10px]" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}><Tag className="w-3 h-3 mr-1" />{product.division}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
