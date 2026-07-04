import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { trpc } from '@/providers/trpc';
import { Upload, FileSpreadsheet, FileText, Database, CheckCircle2, AlertCircle, Loader2, X, FileUp } from 'lucide-react';

// Proper CSV parser that handles commas inside quotes
function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter((r) => r.trim());
  if (lines.length === 0) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v && String(v).trim()));

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += char; }
    }
    result.push(current);
    return result.map((v) => v.trim().replace(/^"|"$/g, '').trim());
  }
}

interface PreviewRow {
  name: string;
  phone: string;
  email: string;
  district: string;
  specialty: string;
  hospital: string;
}

export function Imports() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<any>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [pdfPreview, setPdfPreview] = useState<string>('');

  const { data: jobs, refetch } = trpc.import.jobs.useQuery();
  const parseMutation = trpc.import.parseAndImport.useMutation({
    onMutate: () => { setIsUploading(true); setUploadError(null); },
    onSuccess: (data) => { setParseResult(data); setIsUploading(false); setPreviewData(null); refetch(); },
    onError: (err) => { setUploadError(err.message || 'Import failed'); setIsUploading(false); },
  });

  const processFile = useCallback((file: File) => {
    setParseResult(null);
    setUploadError(null);
    setPreviewData(null);
    setPdfPreview('');
    setFileName(file.name);

    const isPDF = file.name.toLowerCase().endsWith('.pdf');

    if (isPDF) {
      // For PDF: read as text to show preview, then upload via /api/upload
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // PDF preview - just show first 2000 chars as raw text indicator
          setPdfPreview(`PDF file selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)\nThe server will extract names and phone numbers from the PDF.`);
          setPreviewData([]); // empty preview for PDF - server handles parsing
          setParsedRows([]);
        } catch (err: any) {
          setUploadError('PDF read error: ' + err.message);
        }
      };
      reader.readAsText(file);
      return;
    }

    // For CSV/Excel
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows: Record<string, unknown>[] = [];
        if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
          const content = e.target?.result as string;
          rows = parseCSV(content);
        } else {
          // Excel - we need to send to server since we can't parse xlsx in browser easily
          // For now, send raw and let server handle
          setUploadError('Excel files: please use CSV export for now, or the file will be sent to server for parsing');
          return;
        }
        if (rows.length === 0) { setUploadError('No data found. Check headers.'); return; }
        setParsedRows(rows);
        const preview: PreviewRow[] = rows.slice(0, 10).map((row: any) => ({
          name: String(row.name || row.Name || row.NAME || row['Doctor Name'] || ''),
          phone: String(row.phone || row.Phone || row.Mobile || row['Contact Number'] || ''),
          email: String(row.email || row.Email || ''),
          district: String(row.district || row.District || row.City || ''),
          specialty: String(row.specialty || row.Specialty || row.Specialization || ''),
          hospital: String(row.hospital || row.Hospital || ''),
        }));
        setPreviewData(preview);
      } catch (err: any) { setUploadError('Parse error: ' + err.message); }
    };
    if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const confirmImport = async () => {
    if (fileName.toLowerCase().endsWith('.pdf')) {
      // Upload PDF via /api/upload endpoint
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = input?.files?.[0];
      if (!file) { setUploadError('No file selected'); return; }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      setIsUploading(true);
      setUploadError(null);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setParseResult(data);
        setPreviewData(null);
        setPdfPreview('');
        refetch();
      } catch (err: any) {
        setUploadError(err.message);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // CSV via tRPC
    if (parsedRows.length === 0) return;
    parseMutation.mutate({ fileName, fileType: 'csv', rows: parsedRows });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const cancelPreview = () => {
    setPreviewData(null);
    setParsedRows([]);
    setFileName('');
    setUploadError(null);
    setPdfPreview('');
    setParseResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className={`bg-[#111118] border-2 border-dashed transition-all ${isDragging ? 'border-amber-500/50 bg-amber-500/5' : previewData || pdfPreview ? 'border-blue-500/30' : 'border-white/10'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}>
        <CardContent className="p-8 text-center">
          {previewData !== null || pdfPreview ? (
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <FileUp className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{fileName}</h3>
              <p className="text-sm text-zinc-400 mb-4">
                {pdfPreview ? 'PDF ready for processing' : `${parsedRows.length} rows parsed · ${previewData?.length || 0} shown`}
              </p>
              {pdfPreview && (
                <div className="text-left p-3 rounded-lg bg-white/[0.02] mb-4 max-w-md mx-auto">
                  <p className="text-xs text-zinc-400 whitespace-pre-line">{pdfPreview}</p>
                </div>
              )}
              <div className="flex justify-center gap-3">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={confirmImport} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {isUploading ? 'Importing...' : 'Confirm Import'}
                </Button>
                <Button variant="outline" className="border-white/10 text-zinc-400" onClick={cancelPreview} disabled={isUploading}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Upload Files</h3>
              <p className="text-sm text-zinc-500 mb-4">Drag & drop or click to browse</p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Choose File
                <input type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
              </label>
              <div className="flex justify-center gap-5 mt-4">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><FileSpreadsheet className="w-3 h-3 text-emerald-400" /> CSV</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><FileText className="w-3 h-3 text-blue-400" /> PDF</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Database className="w-3 h-3 text-purple-400" /> Excel</span>
              </div>
            </>
          )}
          {uploadError && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{uploadError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {previewData && previewData.length > 0 && (
        <Card className="bg-[#111118] border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-400 mb-2">Data Preview (first {Math.min(previewData.length, 10)} rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-zinc-500 border-b border-white/5">
                  <th className="text-left p-2">Name</th><th className="text-left p-2">Phone</th><th className="text-left p-2">Email</th>
                  <th className="text-left p-2">District</th><th className="text-left p-2">Specialty</th><th className="text-left p-2">Hospital</th>
                </tr></thead>
                <tbody>{previewData.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.02]">
                    <td className="p-2 text-zinc-300">{row.name || '-'}</td>
                    <td className="p-2 text-zinc-400">{row.phone || '-'}</td>
                    <td className="p-2 text-zinc-400">{row.email || '-'}</td>
                    <td className="p-2 text-zinc-400">{row.district || '-'}</td>
                    <td className="p-2 text-zinc-400">{row.specialty || '-'}</td>
                    <td className="p-2 text-zinc-400">{row.hospital || '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {parseResult && (
        <Card className="bg-[#111118] border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Import Complete</h3>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center p-2 rounded-lg bg-white/[0.02]"><p className="text-xl font-bold text-white">{parseResult.totalRows || parseResult.parsedRecords || 0}</p><p className="text-[10px] text-zinc-500">Total Rows</p></div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02]"><p className="text-xl font-bold text-emerald-400">{parseResult.created}</p><p className="text-[10px] text-zinc-500">New Contacts</p></div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02]"><p className="text-xl font-bold text-amber-400">{parseResult.merged}</p><p className="text-[10px] text-zinc-500">Merged</p></div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02]"><p className="text-xl font-bold text-zinc-500">{parseResult.skipped}</p><p className="text-[10px] text-zinc-500">Skipped</p></div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02]"><p className="text-xl font-bold text-blue-400">{parseResult.sourceId}</p><p className="text-[10px] text-zinc-500">Job ID</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card className="bg-[#111118] border-white/5">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" /> Import History</h3>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {(jobs?.items || []).length === 0 && <p className="text-center text-sm text-zinc-600 py-8">No imports yet</p>}
              {(jobs?.items || []).map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : job.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{job.fileName || job.sourceName}</p>
                      <p className="text-[10px] text-zinc-500">{job.sourceType} · {new Date(job.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : job.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{job.status}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
