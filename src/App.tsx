import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/pages/Dashboard';
import { Contacts } from '@/pages/Contacts';
import { Leads } from '@/pages/Leads';
import { Activities } from '@/pages/Activities';
import { Tasks } from '@/pages/Tasks';
import { Products } from '@/pages/Products';
import { Imports } from '@/pages/Imports';
import { Scraping } from '@/pages/Scraping';
import { Analytics } from '@/pages/Analytics';
import { trpc } from '@/providers/trpc';
import type { AppPage } from '@/types';
import { AlertTriangle, Server, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiError, setApiError] = useState(false);

  // Health check on mount
  useEffect(() => {
    fetch('/api/trpc/ping')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.ts === 'number') {
          setApiError(false);
        } else {
          setApiError(true);
        }
      })
      .catch(() => setApiError(true));
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'contacts': return <Contacts searchQuery={searchQuery} />;
      case 'leads': return <Leads searchQuery={searchQuery} />;
      case 'activities': return <Activities />;
      case 'tasks': return <Tasks />;
      case 'products': return <Products />;
      case 'imports': return <Imports />;
      case 'scraping': return <Scraping />;
      case 'analytics': return <Analytics />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  // If API is unreachable, show clear message
  if (apiError) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a0f] text-white">
        <div className="max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Server className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Backend Server Not Running</h1>
              <p className="text-sm text-zinc-500">This is a fullstack app, not a static website</p>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-[#111118] border border-white/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-zinc-300 font-medium">What's happening?</p>
                <p className="text-xs text-zinc-500 mt-1">
                  This CRM has a Node.js backend server that handles database queries, file uploads, and web scraping. 
                  When deployed as a static site, the API endpoints return HTML instead of JSON.
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-sm text-zinc-300 font-medium mb-2">To use this CRM, you have 2 options:</p>
              
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Option 1: Deploy via Kimi Portal (Recommended)</p>
                  <p className="text-[11px] text-zinc-400">
                    Go to your Kimi portal → Projects → find "Agile Master CRM" → click 
                    <strong> "Deploy as Fullstack"</strong>. This starts the Node.js server.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="text-xs font-semibold text-blue-400 mb-1">Option 2: Ask me to switch to Static Mode</p>
                  <p className="text-[11px] text-zinc-400">
                    I can convert the CRM to use in-browser storage (no backend needed). 
                    Data won't persist between sessions, but upload/preview will work immediately.
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} title={getPageTitle(currentPage)} />
        <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
      </div>
    </div>
  );
}

function getPageTitle(page: AppPage): string {
  const titles: Record<AppPage, string> = {
    dashboard: 'Dashboard', contacts: 'Contacts', leads: 'Leads & Pipeline',
    activities: 'Activities', tasks: 'Tasks & Follow-ups', products: 'Product Catalog',
    imports: 'Data Imports', scraping: 'Web Scraping', analytics: 'Analytics & Reports',
  };
  return titles[page] || 'Dashboard';
}
