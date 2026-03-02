import './globals.css';

export const metadata = {
  title: 'ChattyBot Admin',
  description: 'Manage your AI chatbot sites',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span className="logo-icon">💬</span>
              <span className="logo-text">ChattyBot</span>
            </div>
            <nav className="sidebar-nav">
              <a href="/" className="nav-item">Dashboard</a>
              <a href="/sites" className="nav-item">Sites</a>
              <a href="/sites/new" className="nav-item nav-cta">+ New Site</a>
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
