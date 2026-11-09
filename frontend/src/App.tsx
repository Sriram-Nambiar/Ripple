import './App.css'

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="logo">〰 Ripple</h1>
        <p className="subtitle">Atlas · Code Risk Analyzer</p>

        <nav>
          <div className="nav-item active">▦ Dashboard</div>
          <div className="nav-item">▥ Analytics</div>
          <div className="nav-item">ⓘ About</div>
        </nav>

        <div className="sidebar-bottom">
          Built for Hackathons 🚀
        </div>
      </aside>

      <main className="main">
        <header>
          <h1>Welcome to <span>Ripple</span></h1>
          <p>Analyze. Visualize. Mitigate.</p>
        </header>

        <section className="search-box">
          <input
            type="text"
            placeholder="Enter a GitHub Pull Request URL..."
          />
          <button>Analyze PR →</button>
        </section>

        <section className="cards">
          <div className="card">
            <p>Risk Score</p>
            <h2>-- / 100</h2>
            <span>Awaiting analysis</span>
          </div>

          <div className="card">
            <p>Affected Files</p>
            <h2>--</h2>
            <span>Files changed</span>
          </div>

          <div className="card">
            <p>Changed Lines</p>
            <h2>--</h2>
            <span>Lines modified</span>
          </div>

          <div className="card">
            <p>Analysis Time</p>
            <h2>--</h2>
            <span>Waiting for PR</span>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <h2>Risk Overview</h2>
            <div className="placeholder">
              Risk visualization will appear here.
            </div>
          </div>

          <div className="panel">
            <h2>Dependency Graph</h2>
            <div className="placeholder">
              Dependency graph will appear here.
            </div>
          </div>

          <div className="panel">
            <h2>Top Risk Files</h2>
            <div className="placeholder">
              Affected files will appear here.
            </div>
          </div>

          <div className="panel">
            <h2>Recent Analysis</h2>
            <div className="placeholder">
              Your recent PR analysis will appear here.
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
