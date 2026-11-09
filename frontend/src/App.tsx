import { useState, useEffect } from 'react';
import './App.css';

interface FileResult {
  path: string;
  type: 'changed' | 'affected' | 'unaffected';
  status: 'changed' | 'direct_affected' | 'indirect_affected' | 'unaffected';
  riskScore: number;
  impactDepth: number;
  reasons: string[];
  prStatus?: string;
}

interface DependencyEdge {
  source: string;
  target: string;
  importPath: string;
}

interface RiskBreakdown {
  blastRadiusPoints: number;
  depthPoints: number;
  criticalityPoints: number;
  changeSizePoints: number;
  testCoveragePoints: number;
  total: number;
}

interface AnalysisData {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  changedFiles: number;
  affectedFiles: number;
  files: FileResult[];
  dependencies: DependencyEdge[];
  reasons: string[];
  summary: {
    riskScore: number;
    riskLevel: string;
    changedFileCount: number;
    directAffectedCount: number;
    indirectAffectedCount: number;
    totalAffectedCount: number;
    maxImpactDepth: number;
    breakdown: RiskBreakdown;
    warnings: string[];
  };
  warnings: string[];
  executionTimeMs?: number;
  pullRequest?: {
    number: number;
    title: string;
    url: string;
  };
}

const PRESET_OPTIONS = [
  { key: 'auth-core', name: '⚡ Auth Core (Person 2)', url: 'https://github.com/ripple-impact/demo/pull/1' },
  { key: 'user-service', name: '👥 User API & Routes', url: 'https://github.com/ripple-impact/demo/pull/2' },
  { key: 'payment-gateway', name: '💳 Payment Gateway', url: 'https://github.com/ripple-impact/demo/pull/3' },
];

function App() {
  const [prUrl, setPrUrl] = useState('https://github.com/harsh200623/Ripple/pull/2');
  const [activePreset, setActivePreset] = useState<string>('auth-core');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runAnalysis = async (urlToAnalyze?: string, presetKey?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pullRequestUrl: urlToAnalyze || prUrl,
          sampleKey: presetKey,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAnalysis(json.data);
        if (json.data.files && json.data.files.length > 0) {
          setSelectedFile(json.data.files[0]);
        }
      } else {
        setErrorMsg(json.error?.message || 'Failed to analyze pull request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error connecting to analysis backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run default analysis on initial mount
    runAnalysis(undefined, 'auth-core');
  }, []);

  const handlePresetClick = (preset: typeof PRESET_OPTIONS[0]) => {
    setActivePreset(preset.key);
    setPrUrl(preset.url);
    runAnalysis(preset.url, preset.key);
  };

  const getRiskClass = (level?: string) => {
    switch (level) {
      case 'CRITICAL': return 'risk-critical';
      case 'HIGH': return 'risk-high';
      case 'MEDIUM': return 'risk-medium';
      case 'LOW': return 'risk-low';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'changed':
        return <span className="badge badge-changed">Changed</span>;
      case 'direct_affected':
        return <span className="badge badge-direct">Direct</span>;
      case 'indirect_affected':
        return <span className="badge badge-indirect">Indirect</span>;
      default:
        return <span className="badge badge-unaffected">Safe</span>;
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <h1 className="logo">〰 Ripple</h1>
        <p className="subtitle">PR Weather Radar · Impact Engine</p>

        <nav>
          <div className="nav-item active">▦ PR Dashboard</div>
          <div className="nav-item" onClick={() => window.open('https://github.com/harsh200623/Ripple', '_blank')}>
            ▥ GitHub Repo ↗
          </div>
          <div className="nav-item" onClick={() => window.open('https://github.com/harsh200623/Ripple/pull/2', '_blank')}>
            ⓘ PR #2 Merged ↗
          </div>
        </nav>

        <div className="sidebar-bottom">
          <strong>Ripple Core Engine v1.0</strong>
          <p style={{ marginTop: '6px', fontSize: '11px', color: '#a78bfa' }}>
            Tree-sitter AST · Graphology · Reverse BFS
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        <header>
          <h1>Welcome to <span>Ripple</span></h1>
          <p>Analyze blast radius. Visualize reverse dependencies. Mitigate risk before merge.</p>
        </header>

        {/* Preset demo triggers */}
        <div className="preset-bar">
          <span className="preset-label">Quick Scenarios:</span>
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`preset-btn ${activePreset === opt.key ? 'active' : ''}`}
              onClick={() => handlePresetClick(opt)}
            >
              {opt.name}
            </button>
          ))}
        </div>

        {/* PR URL Input */}
        <section className="search-box">
          <input
            type="text"
            value={prUrl}
            onChange={(e) => {
              setPrUrl(e.target.value);
              setActivePreset('');
            }}
            placeholder="Enter a GitHub Pull Request URL (e.g. https://github.com/harsh200623/Ripple/pull/2)..."
          />
          <button disabled={loading} onClick={() => runAnalysis(prUrl)}>
            {loading ? 'Analyzing AST...' : 'Analyze PR →'}
          </button>
        </section>

        {errorMsg && (
          <div style={{ marginTop: '15px', padding: '12px', background: '#451a1a', border: '1px solid #7f1d1d', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
            ⚠ {errorMsg}
          </div>
        )}

        {/* Metric Cards */}
        <section className="cards">
          <div className={`card ${getRiskClass(analysis?.riskLevel)}`}>
            <p>Risk Score</p>
            <h2>{analysis ? `${analysis.riskScore} / 100` : '-- / 100'}</h2>
            <span>{analysis ? `${analysis.riskLevel} RISK` : 'Awaiting analysis'}</span>
          </div>

          <div className="card">
            <p>Affected Dependents</p>
            <h2>{analysis ? analysis.affectedFiles : '--'}</h2>
            <span>{analysis ? `${analysis.summary.directAffectedCount} direct · ${analysis.summary.indirectAffectedCount} indirect` : 'Files downstream'}</span>
          </div>

          <div className="card">
            <p>Max Impact Depth</p>
            <h2>{analysis ? `${analysis.summary.maxImpactDepth} hops` : '--'}</h2>
            <span>{analysis?.summary.maxImpactDepth ? `Reverse BFS propagation` : 'Waiting for PR'}</span>
          </div>

          <div className="card">
            <p>Analysis Speed</p>
            <h2>{analysis?.executionTimeMs !== undefined ? `${analysis.executionTimeMs}ms` : '--'}</h2>
            <span>Static AST Graph Traversal</span>
          </div>
        </section>

        {/* Content Panels */}
        <section className="content-grid">
          {/* Panel 1: Risk Overview */}
          <div className="panel">
            <h2>
              <span>Risk Overview & Breakdown</span>
              {analysis && (
                <span className={`badge ${analysis.riskScore >= 50 ? 'badge-changed' : 'badge-direct'}`}>
                  {analysis.riskLevel}
                </span>
              )}
            </h2>

            {analysis ? (
              <div>
                <div className="breakdown-row">
                  <div className="breakdown-labels">
                    <span>Blast Radius (Affected Files)</span>
                    <span>{analysis.summary.breakdown.blastRadiusPoints} / 35 pts</span>
                  </div>
                  <div className="breakdown-bar-bg">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${(analysis.summary.breakdown.blastRadiusPoints / 35) * 100}%`, background: '#f43f5e' }}
                    />
                  </div>
                </div>

                <div className="breakdown-row">
                  <div className="breakdown-labels">
                    <span>Dependency Depth</span>
                    <span>{analysis.summary.breakdown.depthPoints} / 20 pts</span>
                  </div>
                  <div className="breakdown-bar-bg">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${(analysis.summary.breakdown.depthPoints / 20) * 100}%`, background: '#fbbf24' }}
                    />
                  </div>
                </div>

                <div className="breakdown-row">
                  <div className="breakdown-labels">
                    <span>Module Criticality</span>
                    <span>{analysis.summary.breakdown.criticalityPoints} / 20 pts</span>
                  </div>
                  <div className="breakdown-bar-bg">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${(analysis.summary.breakdown.criticalityPoints / 20) * 100}%`, background: '#8b5cf6' }}
                    />
                  </div>
                </div>

                <div className="breakdown-row">
                  <div className="breakdown-labels">
                    <span>Change Volume</span>
                    <span>{analysis.summary.breakdown.changeSizePoints} / 15 pts</span>
                  </div>
                  <div className="breakdown-bar-bg">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${(analysis.summary.breakdown.changeSizePoints / 15) * 100}%`, background: '#38bdf8' }}
                    />
                  </div>
                </div>

                <div className="breakdown-row">
                  <div className="breakdown-labels">
                    <span>Test Verification Factor</span>
                    <span>{analysis.summary.breakdown.testCoveragePoints} / 10 pts</span>
                  </div>
                  <div className="breakdown-bar-bg">
                    <div
                      className="breakdown-bar-fill"
                      style={{ width: `${(analysis.summary.breakdown.testCoveragePoints / 10) * 100}%`, background: '#a855f7' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>KEY DRIVERS:</p>
                  {analysis.reasons.map((r, i) => (
                    <div key={i} className="reason-bullet">
                      <span className="reason-icon">▸</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="placeholder">Risk visualization will appear here.</div>
            )}
          </div>

          {/* Panel 2: Interactive Dependency Graph */}
          <div className="panel">
            <h2>
              <span>Dependency Blast Radius Graph</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                {analysis ? `${analysis.files.length} nodes · ${analysis.dependencies.length} edges` : ''}
              </span>
            </h2>

            {analysis ? (
              <div>
                <svg className="graph-svg" viewBox="0 0 500 240">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
                    </marker>
                  </defs>

                  {/* Render dependency edges */}
                  {analysis.dependencies.map((edge, i) => {
                    const sourceIdx = analysis.files.findIndex((f) => f.path === edge.source);
                    const targetIdx = analysis.files.findIndex((f) => f.path === edge.target);

                    const x1 = 80 + (sourceIdx >= 0 ? (sourceIdx % 3) * 160 : 80);
                    const y1 = 60 + Math.floor(sourceIdx / 3) * 90;
                    const x2 = 80 + (targetIdx >= 0 ? (targetIdx % 3) * 160 : 380);
                    const y2 = 60 + Math.floor(targetIdx / 3) * 90;

                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#475569"
                        strokeWidth="2"
                        strokeDasharray="4"
                        markerEnd="url(#arrow)"
                      />
                    );
                  })}

                  {/* Render file nodes */}
                  {analysis.files.map((file, i) => {
                    const x = 80 + (i % 3) * 160;
                    const y = 60 + Math.floor(i / 3) * 90;

                    let fill = '#1e293b';
                    let stroke = '#475569';
                    if (file.status === 'changed') {
                      fill = '#881337';
                      stroke = '#f43f5e';
                    } else if (file.status === 'direct_affected') {
                      fill = '#78350f';
                      stroke = '#fbbf24';
                    } else if (file.status === 'indirect_affected') {
                      fill = '#312e81';
                      stroke = '#818cf8';
                    }

                    const isSelected = selectedFile?.path === file.path;

                    return (
                      <g
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 24 : 20}
                          fill={fill}
                          stroke={isSelected ? '#ffffff' : stroke}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <text
                          x={x}
                          y={y + 4}
                          fill="#ffffff"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {file.path.split('/').pop()?.slice(0, 11)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Node details footer */}
                {selectedFile && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace' }}>
                        {selectedFile.path}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {selectedFile.reasons[0] || 'Selected module'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa' }}>
                        Score: {selectedFile.riskScore}
                      </span>
                      {getStatusBadge(selectedFile.status)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="placeholder">Dependency graph will appear here.</div>
            )}
          </div>

          {/* Panel 3: Top Risk Files */}
          <div className="panel">
            <h2>
              <span>Affected & Changed Files</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                {analysis?.files.length || 0} total files
              </span>
            </h2>

            {analysis ? (
              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {analysis.files.map((f) => (
                  <div
                    key={f.path}
                    className={`file-item ${selectedFile?.path === f.path ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(f)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getStatusBadge(f.status)}
                      <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{f.path}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {f.impactDepth >= 0 ? `${f.impactDepth} hops` : 'unaffected'}
                      </span>
                      <span style={{ fontWeight: 700, color: f.riskScore >= 70 ? '#f43f5e' : f.riskScore >= 40 ? '#fbbf24' : '#10b981' }}>
                        {f.riskScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder">Affected files will appear here.</div>
            )}
          </div>

          {/* Panel 4: Recent Analysis & Explanations */}
          <div className="panel">
            <h2>
              <span>PR Context & Audit Log</span>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>● Analysis Active</span>
            </h2>

            {analysis ? (
              <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                <p><strong>Pull Request:</strong> <span style={{ color: '#a78bfa' }}>{analysis.pullRequest?.title || 'PR Analysis'}</span></p>
                <p style={{ marginTop: '4px' }}><strong>Target URL:</strong> <a href={analysis.pullRequest?.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>{analysis.pullRequest?.url}</a></p>
                <p style={{ marginTop: '4px' }}><strong>Downstream Blast Radius:</strong> {analysis.summary.totalAffectedCount} files potentially impacted across {analysis.summary.maxImpactDepth} dependency levels.</p>

                {analysis.warnings.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px', background: '#3b2110', border: '1px solid #78350f', borderRadius: '6px', fontSize: '12px', color: '#fde047' }}>
                    <strong>Warnings detected:</strong>
                    <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                      {analysis.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: '16px', padding: '12px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Reviewer Recommendation</div>
                  <div style={{ marginTop: '4px', color: analysis.riskScore >= 75 ? '#fda4af' : analysis.riskScore >= 50 ? '#fef08a' : '#a7f3d0' }}>
                    {analysis.riskScore >= 75
                      ? '⚠️ High blast radius touching critical modules. Multi-reviewer sign-off and integration tests strongly recommended.'
                      : analysis.riskScore >= 50
                      ? '🔍 Moderate downstream impact. Verify dependent controllers and service unit tests before merge.'
                      : '✅ Low architectural risk. Changes are isolated or localized.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="placeholder">Your recent PR analysis will appear here.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
