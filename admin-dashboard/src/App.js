import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ConversationsPage from './pages/ConversationsPage';
import TranscriptViewer from './pages/TranscriptViewer';
import LeadDashboard from './pages/LeadDashboard';
import StatsPage from './pages/StatsPage';

function App() {
  const [siteFilter, setSiteFilter] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">ChattyBot Analytics</h1>
                
                {/* Desktop Navigation */}
                <div className="hidden md:flex space-x-6 ml-8">
                  <NavLinks />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Site Filter */}
                <SiteFilter value={siteFilter} onChange={setSiteFilter} />
                
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Toggle menu"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {mobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden pb-4">
                <div className="flex flex-col space-y-2">
                  <MobileNavLinks onClick={() => setMobileMenuOpen(false)} />
                </div>
              </div>
            )}
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Routes>
            <Route path="/" element={<ConversationsPage siteFilter={siteFilter} />} />
            <Route path="/conversations" element={<ConversationsPage siteFilter={siteFilter} />} />
            <Route path="/transcript/:id" element={<TranscriptViewer />} />
            <Route path="/leads" element={<LeadDashboard siteFilter={siteFilter} />} />
            <Route path="/stats" element={<StatsPage siteFilter={siteFilter} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NavLinks() {
  const location = useLocation();
  
  const links = [
    { path: '/conversations', label: 'Conversations' },
    { path: '/leads', label: 'Leads' },
    { path: '/stats', label: 'Analytics' },
  ];

  return (
    <>
      {links.map(link => (
        <Link
          key={link.path}
          to={link.path}
          className={`text-sm font-medium ${
            location.pathname === link.path
              ? 'text-primary border-b-2 border-primary pb-4'
              : 'text-gray-600 hover:text-gray-900 pb-4'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

function MobileNavLinks({ onClick }) {
  const location = useLocation();
  
  const links = [
    { path: '/conversations', label: 'Conversations' },
    { path: '/leads', label: 'Leads' },
    { path: '/stats', label: 'Analytics' },
  ];

  return (
    <>
      {links.map(link => (
        <Link
          key={link.path}
          to={link.path}
          onClick={onClick}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            location.pathname === link.path
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

function SiteFilter({ value, onChange }) {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/admin/sites`, {
      headers: { Authorization: `Bearer ${process.env.REACT_APP_ADMIN_SECRET}` },
    })
      .then(r => r.json())
      .then(data => setSites(data.sites || []))
      .catch(err => console.error('Failed to load sites:', err));
  }, []);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs sm:text-sm border border-gray-300 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">All Sites</option>
      {sites.map(site => (
        <option key={site.id} value={site.id}>
          {site.company_name}
        </option>
      ))}
    </select>
  );
}

export default App;
