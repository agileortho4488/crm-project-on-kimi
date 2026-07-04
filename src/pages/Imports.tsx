import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/providers/trpc';
import { Upload, FileSpreadsheet, FileText, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export function Imports() {
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const { data: jobs, refetch } = trpc.import.jobs.useQuery();
  const parseMutation = trpc.import.parseAndImport.useMutation({
    onSuccess: (data) => { setParseResult(data); refetch(); },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Parse CSV
      const rows = content.split('\n').filter((r) => r.trim());
      const headers = rows[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const data = rows.slice(1).map((row) => {
        const values = row.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      }).filter((r) => Object.values(r).some((v) => v));

      parseMutation.mutate({
        fileName: file.name,
        fileType: 'csv',
        rows: data,
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className={`bg-[#111118] border-2 border-dashed transition-all ${isDragging ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Upload Files</h3>
          <p className="text-sm text-zinc-500 mb-4">Drag & drop CSV, Excel, or PDF files here</p>
          <div className="flex justify-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors">
              Choose File
              <input type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <span className="flex items-center gap-1 text-[10px] text-zinc-600"><FileSpreadsheet className="w-3 h-3" /> CSV</span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-600"><FileText className="w-3 h-3" /> Excel</span>
          </div>
        </CardContent>
      </Card>

      {/* Parse Result */}
      {parseResult && (
        <Card className="bg-[#111118] border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Import Complete</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center"><p className="text-xl font-bold text-white">{parseResult.totalRows}</p><p className="text-[10px] text-zinc-500">Total Rows</p></div>
              <div className="text-center"><p className="text-xl font-bold text-blue-400">{parseResult.parsedRecords}</p><p className="text-[10px] text-zinc-500">Parsed</p></div>
              <div className="text-center"><p className="text-xl font-bold text-emerald-400">{parseResult.created}</p><p className="text-[10px] text-zinc-500">Created</p></div>
              <div className="text-center"><p className="text-xl font-bold text-amber-400">{parseResult.duplicates}</p><p className="text-[10px] text-zinc-500">Duplicates</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card className="bg-[#111118] border-white/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-white flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" /> Import History</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {(jobs?.items || []).map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{job.fileName || job.sourceName}</p>
                      <p className="text-[10px] text-zinc-500">{job.sourceType} · {new Date(job.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-[9px] ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{job.status}</Badge>
                    <p className="text-[10px] text-zinc-500 mt-1">{job.processedCount || 0} / {job.rawDataCount || 0} records</p>
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


