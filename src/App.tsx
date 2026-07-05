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
import { Campaigns } from '@/pages/Campaigns';
import { Analytics } from '@/pages/Analytics';
import { DataQuality } from '@/pages/DataQuality';
import { EnrichmentHub } from '@/pages/EnrichmentHub';
import { MapDashboard } from '@/pages/MapDashboard';
import { Login } from '@/pages/Login';
import { AdminPanel } from '@/pages/AdminPanel';
import type { AppPage } from '@/types';
import { trpc } from '@/providers/trpc';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('crm_token'));
  const [user, setUser] = useState<any>(null);

  const { data: authData } = trpc.auth.me.useQuery(
    token ? { token } : undefined,
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (authData?.user) {
      setUser(authData.user);
    } else if (authData && !authData.user) {
      localStorage.removeItem('crm_token');
      setToken(null);
      setUser(null);
    }
  }, [authData]);

  const handleLogin = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    setToken(null);
    setUser(null);
    setCurrentPage('dashboard');
  };

  // Show login if not authenticated
  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  // Admin Panel as special page
  if (currentPage === 'adminpanel') {
    return (
      <div className="flex h-screen w-screen bg-[#0a0a0f] overflow-hidden">
        <Sidebar currentPage="adminpanel" onNavigate={(p) => setCurrentPage(p as AppPage)} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} userRole={user.role} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} title="Admin Panel" user={user} onLogout={handleLogout} />
          <main className="flex-1 overflow-auto p-6"><AdminPanel token={token} /></main>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'contacts': return <Contacts searchQuery={searchQuery} />;
      case 'leads': return <Leads searchQuery={searchQuery} />;
      case 'activities': return <Activities />;
      case 'tasks': return <Tasks />;
      case 'products': return <Products />;
      case 'imports': return <Imports />;
      case 'dataquality': return <DataQuality />;
      case 'enrichmenthub': return <EnrichmentHub />;
      case 'maps': return <MapDashboard />;
      case 'scraping': return <Scraping />;
      case 'campaigns': return <Campaigns />;
      case 'analytics': return <Analytics />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} userRole={user.role} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} title={getPageTitle(currentPage)} user={user} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
      </div>
    </div>
  );
}

function getPageTitle(page: AppPage): string {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard', contacts: 'Contacts', leads: 'Leads & Pipeline',
    activities: 'Activities', tasks: 'Tasks & Follow-ups', products: 'Product Catalog',
    imports: 'Data Imports', dataquality: 'Data Quality', enrichmenthub: 'Enrichment Hub',
    scraping: 'Web Scraping', campaigns: 'Campaigns', analytics: 'Analytics & Reports',
    adminpanel: 'Admin Panel',
  };
  return titles[page] || 'Dashboard';
}
