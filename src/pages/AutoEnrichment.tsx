import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/providers/trpc';
import { 
  Bot, Play, Square, RotateCcw, Loader2, Activity,
  Building2, Stethoscope, MapPin, Star, Clock,
  CheckCircle2, AlertCircle, Zap, TrendingUp,
  Phone, Users, BarChart3, ChevronDown, ChevronUp
} from 'lucide-react';

export function AutoEnrichment() {
  const [isRunning, setIsRunning] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  
  // Get status
  const { data: status, refetch: refetchStatus } = trpc.autoEnrichment.status.useQuery(undefined, {
    refetchInterval: isRunning ? 3000 : 10000, // Poll every 3s when running, 10s when idle
  });
  
  // Mutations
  const startMutation = trpc.autoEnrichment.start.useMutation({
    onSuccess: (data) => {
      setIsRunning(data.state?.isRunning || false);
      refetchStatus();
    },
  });
  
  const stopMutation = trpc.autoEnrichment.stop.useMutation({
    onSuccess: () => {
      setIsRunning(false);
      refetchStatus();
    },
  });
  
  const runBatchMutation = trpc.autoEnrichment.runBatch.useMutation({
    onSuccess: () => refetchStatus(),
  });
  
  // Update local state from server
  useEffect(() => {
    if (status) {
      setIsRunning(status.running);
    }
  }, [status]);
  
  const state = status?.state;
  const dbStats = status?.dbStats;
  
  // Calculate progress
  const progressPercent = state?.maxId > 0 
    ? Math.round((state?.lastContactId || 0) / state?.maxId * 100) 
    : 0;
  
  const elapsed = state?.startedAt 
    ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed > 3600 
    ? `${Math.floor(elapsed/3600)}h ${Math.floor((elapsed%3600)/60)}m`
    : `${Math.floor(elapsed/60)}m ${elapsed%60}s`;
  
  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-400" />
            Auto Enrichment
          </h1>
          <p className="text-sm text-zinc-500">
            Fully automatic - extracts hospitals, specialties, addresses from names. Zero manual work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-0 animate-pulse">
              <Activity className="w-3 h-3 mr-1" /> Running
            </Badge>
          )}
        </div>
      </div>
      
      {/* Control Panel */}
      <Card className="bg-[#111118] border-white/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* Start/Stop Button */}
            {!isRunning ? (
              <Button 
                size="lg"
                className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold px-6"
                onClick={() => startMutation.mutate({ batchSize: 100, delayMs: 5000 })}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                {startMutation.isPending ? 'Starting...' : 'Start Auto Enrichment'}
              </Button>
            ) : (
              <Button 
                size="lg"
                variant="destructive"
                className="font-semibold px-6"
                onClick={() => stopMutation.mutate()}
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            )}
            
            {/* Manual Batch Button */}
            <Button
              variant="outline"
              size="lg"
              className="border-white/10 text-zinc-300 hover:text-white"
              onClick={() => runBatchMutation.mutate({ batchSize: 100 })}
              disabled={runBatchMutation.isPending}
            >
              {runBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              Process 100 Now
            </Button>
            
            {/* Status Text */}
            <div className="flex-1">
              {isRunning ? (
                <div className="text-sm">
                  <span className="text-emerald-400 font-medium">
                    Processing batch {state?.currentBatch?.toLocaleString()} of {state?.totalBatches?.toLocaleString()}
                  </span>
                  <span className="text-zinc-500 ml-2">
                    ({progressPercent}% complete, {elapsedStr} elapsed)
                  </span>
                </div>
              ) : state?.totalProcessed > 0 ? (
                <div className="text-sm text-zinc-400">
                  Last run: {state?.totalProcessed?.toLocaleString()} processed, {state?.totalUpdated?.toLocaleString()} updated
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  Click "Start" to begin automatic enrichment of all contacts
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          {isRunning && (
            <div className="mt-4">
              <Progress value={progressPercent} className="h-2 bg-white/5" />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>ID: {state?.lastContactId?.toLocaleString()}</span>
                <span>{progressPercent}%</span>
                <span>Max ID: {state?.maxId?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Stats Grid */}
      {dbStats && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard 
            icon={<Users className="w-4 h-4" />} 
            label="Total Contacts" 
            value={dbStats.total.toLocaleString()} 
            color="text-white"
          />
          <StatCard 
            icon={<Building2 className="w-4 h-4" />} 
            label="With Hospital" 
            value={`${dbStats.withHospital.toLocaleString()}`} 
            subtitle={`${dbStats.hospitalPercent}%`}
            color="text-emerald-400"
          />
          <StatCard 
            icon={<Stethoscope className="w-4 h-4" />} 
            label="With Specialty" 
            value={`${dbStats.withSpecialty.toLocaleString()}`} 
            subtitle={`${dbStats.specialtyPercent}%`}
            color="text-sky-400"
          />
          <StatCard 
            icon={<Star className="w-4 h-4" />} 
            label="Avg Quality" 
            value={`${dbStats.avgQuality}/100`} 
            color="text-amber-400"
          />
        </div>
      )}
      
      {/* Running Stats */}
      {isRunning && state && (
        <div className="grid grid-cols-4 gap-3">
          <RunningStat label="Processed" value={state.totalProcessed?.toLocaleString()} icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} />
          <RunningStat label="Updated" value={state.totalUpdated?.toLocaleString()} icon={<CheckCircle2 className="w-4 h-4 text-sky-400" />} />
          <RunningStat label="Current Batch" value={`${state.currentBatch?.toLocaleString()}`} icon={<Activity className="w-4 h-4 text-amber-400" />} />
          <RunningStat label="Elapsed" value={elapsedStr} icon={<Clock className="w-4 h-4 text-purple-400" />} />
        </div>
      )}
      
      {/* How It Works */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
            <Bot className="w-4 h-4" /> How Auto Enrichment Works
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-3">
            <StageCard 
              number="1" 
              title="Extract Hospital" 
              description="Parses doctor names to find hospital/clinic names like 'Apollo Hospital', 'Care Hospital'"
              icon={<Building2 className="w-4 h-4" />}
              color="text-emerald-400"
            />
            <StageCard 
              number="2" 
              title="Infer Specialty" 
              description="Detects specialty from name patterns: 'Heart Centre' → Cardiology, 'Eye Clinic' → Ophthalmology"
              icon={<Stethoscope className="w-4 h-4" />}
              color="text-sky-400"
            />
            <StageCard 
              number="3" 
              title="Classify Type" 
              description="Determines if contact is doctor, hospital, clinic, distributor, or corporate from name"
              icon={<Users className="w-4 h-4" />}
              color="text-amber-400"
            />
            <StageCard 
              number="4" 
              title="Quality Score" 
              description="Recalculates quality (0-100) based on data completeness: name, phone, hospital, specialty, address"
              icon={<Star className="w-4 h-4" />}
              color="text-purple-400"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Activity Log */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setLogsExpanded(!logsExpanded)}>
          <CardTitle className="text-sm text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Activity Log
              {state?.recentLogs?.length > 0 && (
                <Badge className="bg-white/5 text-zinc-400 text-[10px] border-0">{state.recentLogs.length} entries</Badge>
              )}
            </span>
            {logsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {logsExpanded && (
          <CardContent className="pt-0">
            <div className="bg-black/30 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-[11px] space-y-1">
              {state?.recentLogs?.length === 0 ? (
                <p className="text-zinc-600">No activity yet. Start enrichment to see logs.</p>
              ) : (
                state?.recentLogs?.map((log, i) => (
                  <p key={i} className={i === 0 ? 'text-emerald-400' : 'text-zinc-500'}>{log}</p>
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, color }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; color: string }) {
  return (
    <Card className="bg-[#111118] border-white/5">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
          {icon}
          <span className="text-[10px] uppercase">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-[10px] text-zinc-600">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function RunningStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-[#111118] border-white/5">
      <CardContent className="p-3 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
          <p className="text-sm font-bold text-zinc-200">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StageCard({ number, title, description, icon, color }: { number: string; title: string; description: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold ${color}`}>{number}.</span>
        <span className={`${color}`}>{icon}</span>
        <span className="text-xs font-medium text-zinc-300">{title}</span>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}
