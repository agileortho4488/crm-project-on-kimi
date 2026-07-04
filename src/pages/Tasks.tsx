import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/providers/trpc';
import { Clock, AlertCircle, CheckCircle2, Circle, User, Calendar } from 'lucide-react';

const statusCfg: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Circle, color: '#a1a1aa', label: 'Pending' },
  'in_progress': { icon: Clock, color: '#3b82f6', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: '#10b981', label: 'Done' },
  overdue: { icon: AlertCircle, color: '#ef4444', label: 'Overdue' },
};

const priorityColors: Record<string, string> = {
  low: 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10',
  medium: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
  high: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
  urgent: 'text-red-400 border-red-500/20 bg-red-500/10',
};

export function Tasks() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' as const });

  const { data, refetch } = trpc.task.list.useQuery({ status: filterStatus === 'all' ? undefined : filterStatus, limit: 200 });
  const createMutation = trpc.task.create.useMutation({ onSuccess: () => { refetch(); setShowAdd(false); } });
  const updateMutation = trpc.task.update.useMutation({ onSuccess: () => refetch() });

  const tasks = data?.items || [];
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
  };
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      <div className="grid grid-cols-5 gap-3">
        {[{ label: 'Total', value: stats.total, color: '#a1a1aa' }, { label: 'Pending', value: stats.pending, color: '#f59e0b' }, { label: 'In Progress', value: stats.inProgress, color: '#3b82f6' }, { label: 'Done', value: stats.completed, color: '#10b981' }, { label: 'Overdue', value: stats.overdue, color: '#ef4444' }].map((s) => (
          <Card key={s.label} className="bg-[#111118] border-white/5"><CardContent className="p-3 text-center"><p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p><p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList className="bg-[#111118] border border-white/5">
            {['all', 'pending', 'in_progress', 'overdue'].map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 capitalize">{s.replace('_', ' ')}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => setShowAdd(true)}>Add Task</Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-2">
          {tasks.map((task) => {
            const cfg = statusCfg[task.status];
            const StatusIcon = cfg.icon;
            const isDone = task.status === 'completed';
            return (
              <Card key={task.id} className={`bg-[#111118] border-white/5 ${task.status === 'overdue' ? 'border-red-500/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={isDone} onCheckedChange={() => updateMutation.mutate({ id: task.id, status: isDone ? 'pending' : 'completed' })} className="mt-1 border-white/20 data-[state=checked]:bg-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</p>
                        <Badge variant="outline" className="text-[9px]" style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}><StatusIcon className="w-2.5 h-2.5 mr-1" />{cfg.label}</Badge>
                        <Badge variant="outline" className={`text-[9px] ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-zinc-500"><User className="w-3 h-3" /> {task.assignedTo || 'Unassigned'}</span>
                        {task.dueDate && <span className={`flex items-center gap-1 text-[10px] ${task.status === 'overdue' ? 'text-red-400' : 'text-zinc-500'}`}><Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#111118] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Task Title *" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Assigned To" value={newTask.assignedTo} onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })} className="bg-white/5 border-white/10" />
            <Input placeholder="Due Date (YYYY-MM-DD)" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="bg-white/5 border-white/10" />
            <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => createMutation.mutate(newTask)}>Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
