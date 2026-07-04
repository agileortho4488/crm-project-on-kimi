import { useState } from 'react';
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
import type { AppPage } from '@/types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    dashboard: 'Dashboard',
    contacts: 'Contacts',
    leads: 'Leads & Pipeline',
    activities: 'Activities',
    tasks: 'Tasks & Follow-ups',
    products: 'Product Catalog',
    imports: 'Data Imports',
    scraping: 'Web Scraping',
    analytics: 'Analytics & Reports',
  };
  return titles[page] || 'Dashboard';
}
