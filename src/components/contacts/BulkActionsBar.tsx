import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/providers/trpc';
import { 
  Download, Send, Trash2, X, CheckSquare, Stethoscope,
  MessageCircle, ChevronDown
} from 'lucide-react';

interface Props {
  selectedIds: number[];
  selectedContacts: Array<{ id: number; name: string; phone: string | null; division: string | null }>;
  onClear: () => void;
  onRefresh: () => void;
}

const DIVISION_OPTIONS = [
  { value: 'gynecology', label: 'Gynecology' },
  { value: 'trauma_fracture', label: 'Trauma & Fracture' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'neuro_spine', label: 'Neuro & Spine' },
  { value: 'endo_surgery', label: 'Endo-Surgery' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'consumables', label: 'Consumables' },
];

export function BulkActionsBar({ selectedIds, selectedContacts, onClear, onRefresh }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const bulkDelete = trpc.contact.bulkDelete.useMutation({
    onSuccess: () => {
      setActionInProgress(null);
      onClear();
      onRefresh();
    },
  });

  const bulkUpdateDivision = trpc.contact.bulkUpdateDivision.useMutation({
    onSuccess: () => {
      setActionInProgress(null);
      onClear();
      onRefresh();
    },
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Type', 'Specialty', 'Phone', 'Email', 'Hospital', 'District', 'Division', 'Status', 'Quality Score'];
    const rows = selectedContacts.map(c => [
      c.id, c.name, '', '', c.phone || '', '', '', '', c.division || '', '', ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_export_${selectedIds.length}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWhatsAppCampaign = () => {
    const phoneNumbers = selectedContacts
      .filter(c => c.phone && c.phone.length >= 10)
      .map(c => c.phone!.replace(/\D/g, '').slice(-10));
    
    if (phoneNumbers.length === 0) {
      alert('No valid phone numbers in selection');
      return;
    }

    // Generate wa.me links for each contact
    const message = encodeURIComponent('Hello from Agile Ortho Surgical Hub!');
    if (phoneNumbers.length <= 5) {
      // Open each in new tab (for small selections)
      phoneNumbers.forEach(num => {
        window.open(`https://wa.me/91${num}?text=${message}`, '_blank');
      });
    } else {
      // For large selections, show in a dialog or copy to clipboard
      const links = phoneNumbers.map(num => `https://wa.me/91${num}?text=${message}`).join('\n');
      navigator.clipboard.writeText(links).then(() => {
        alert(`${phoneNumbers.length} WhatsApp links copied to clipboard!`);
      });
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    setActionInProgress('delete');
    bulkDelete.mutate(selectedIds);
  };

  const handleChangeDivision = (division: string) => {
    setActionInProgress('division');
    bulkUpdateDivision.mutate({ ids: selectedIds, division });
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl shadow-black/50 flex items-center gap-1 px-2 py-2">
          {/* Selection count */}
          <div className="flex items-center gap-2 px-3">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">{selectedIds.length}</span>
            <span className="text-xs text-zinc-500">selected</span>
          </div>

          <Separator orientation="vertical" className="h-6 bg-white/10" />

          {/* Export */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-zinc-300 hover:text-white hover:bg-white/5 gap-1.5"
            onClick={handleExportCSV}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>

          {/* WhatsApp */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-zinc-300 hover:text-green-400 hover:bg-green-500/10 gap-1.5"
            onClick={handleWhatsAppCampaign}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </Button>

          {/* Change Division */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-zinc-300 hover:text-white hover:bg-white/5 gap-1.5"
                disabled={actionInProgress === 'division'}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Division
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1a1a24] border-white/10">
              {DIVISION_OPTIONS.map(div => (
                <DropdownMenuItem
                  key={div.value}
                  onClick={() => handleChangeDivision(div.value)}
                  className="text-xs text-zinc-300 hover:text-white focus:bg-white/5 cursor-pointer"
                >
                  {div.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6 bg-white/10" />

          {/* Delete */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-zinc-300 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={actionInProgress === 'delete'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          {/* Close */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-zinc-500 hover:text-white hover:bg-white/5"
            onClick={onClear}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#1a1a24] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete {selectedIds.length} Contacts
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This action cannot be undone. Are you sure you want to permanently delete these {selectedIds.length} contacts?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
