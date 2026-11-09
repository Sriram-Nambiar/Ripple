import { useState, useEffect } from 'react';
import { Graph3D } from './components/Graph3D';
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
  {
    key: 'auth-core',
    name: '⚡ Auth Module (Person 2)',
    url: 'https://github.com/ripple-impact/demo/pull/1',
    description: 'Core auth refactor affecting users, orders, profile, and checkout',
  },
  {
    key: 'user-service',
    name: '👥 User Service & Routes',
    url: 'https://github.com/ripple-impact/demo/pull/2',
    description: 'User model modification propagating to controllers and express routes',
  },
  {
    key: 'payment-gateway',
    name: '💳 Stripe Payment Intent',
    url: 'https://github.com/ripple-impact/demo/pull/3',
    description: 'High-criticality billing service refactor with deep propagation',
  },
];

function App() {
  const [prUrl, setPrUrl] = useState('https://github.com/harsh200623/Ripple/pull/2');
  const [activePreset, setActivePreset] = useState<string>('auth-core');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileResult | null>(null);
  const [fileFilter, setFileFilter] = useState<'all' | 'changed' | 'direct' | 'indirect' | 'safe'>('all');
  const [graphMode, setGraphMode] = useState<'3d' | '2d'>('3d');
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
    // Run default scenario on initial mount
    runAnalysis(undefined, 'auth-core');
  }, []);

  const handlePresetClick = (preset: typeof PRESET_OPTIONS[0]) => {
    setActivePreset(preset.key);
    setPrUrl(preset.url);
    runAnalysis(preset.url, preset.key);
  };

  const getRiskTagClass = (level?: string) => {
    switch (level) {
      case 'CRITICAL': return 'tag-critical';
      case 'HIGH': return 'tag-high';
      case 'MEDIUM': return 'tag-medium';
      case 'LOW': return 'tag-low';
      default: return 'tag-medium';
    }
  };

  const getRiskCardClass = (level?: string) => {
    switch (level) {
      case 'CRITICAL': return 'risk-card-critical';
      case 'HIGH': return 'risk-card-high';
      case 'MEDIUM': return 'risk-card-medium';
      case 'LOW': return 'risk-card-low';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'changed':
        return <span className="risk-level-tag tag-critical">Changed</span>;
      case 'direct_affected':
        return <span className="risk-level-tag tag-medium">Direct</span>;
      case 'indirect_affected':
        return <span className="risk-level-tag tag-high" style={{ background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', borderColor: 'rgba(99,102,241,0.4)' }}>Indirect</span>;
      default:
        return <span className="risk-level-tag" style={{ background: 'rgba(100,116,139,0.2)', color: '#94a3b8', borderColor: 'rgba(100,116,139,0.3)' }}>Safe</span>;
    }
  };

  // Filter files based on selected tab
  const filteredFiles = analysis?.files.filter((f) => {
    if (fileFilter === 'changed') return f.status === 'changed';
    if (fileFilter === 'direct') return f.status === 'direct_affected';
    if (fileFilter === 'indirect') return f.status === 'indirect_affected';
    if (fileFilter === 'safe') return f.status === 'unaffected';
    return true;
  }) || [];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="brand-section">
          <div className="brand-icon-box">
            <span>〰</span>
          </div>
          <div className="brand-titles">
            <span className="brand-name">Ripple</span>
            <span className="brand-subtitle">PR Weather Radar</span>
          </div>
        </div>

        <div className="status-pill-online">
          <span className="pulse-dot"></span>
          <span>Engine Online · v1.0</span>
        </div>

        <nav className="nav-group">
          <div className="nav-group-title">Analytics</div>
          <div className="nav-link active">
            <span>▦</span>
            <span>Blast Radius Radar</span>
          </div>
          <div className="nav-link" onClick={() => window.open('https://github.com/harsh200623/Ripple/pull/2', '_blank')}>
            <span>↗</span>
            <span>PR #2 (Core Engine)</span>
          </div>
          <div className="nav-link" onClick={() => window.open('https://github.com/harsh200623/Ripple', '_blank')}>
            <span>★</span>
            <span>GitHub Repository</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-engine-title">
            <span>⚡ Tree-sitter & Graphology</span>
          </div>
          <div className="footer-engine-desc">
            Deterministic AST reverse graph traversal with heuristic risk scoring.
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {/* Header */}
        <header className="view-header">
          <div>
            <h1>Pull Request <span>Impact Radar</span></h1>
            <p>Predict downstream code breakage and architectural blast radius before merge.</p>
          </div>
          <div className="header-badges">
            <span className="meta-pill">AST Reverse BFS</span>
            <span className="meta-pill">Zero Runtime Execution</span>
          </div>
        </header>

        {/* Preset Scenarios */}
        <div className="scenario-bar">
          <span className="scenario-title">Preset Scenarios:</span>
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`scenario-chip ${activePreset === opt.key ? 'active' : ''}`}
              onClick={() => handlePresetClick(opt)}
            >
              {opt.name}
            </button>
          ))}
        </div>

        {/* Command Search Bar */}
        <div className="command-bar">
          <span className="command-icon">⑂</span>
          <input
            type="text"
            className="command-input"
            value={prUrl}
            onChange={(e) => {
              setPrUrl(e.target.value);
              setActivePreset('');
            }}
            placeholder="Enter public GitHub PR URL (e.g. https://github.com/harsh200623/Ripple/pull/2)..."
          />
          <button
            className="command-btn"
            disabled={loading}
            onClick={() => runAnalysis(prUrl)}
          >
            {loading ? (
              <>
                <span className="pulse-dot" style={{ background: '#fff' }}></span>
                <span>Traversing AST...</span>
              </>
            ) : (
              <span>Analyze Blast Radius →</span>
            )}
          </button>
        </div>

        {errorMsg && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Metric HUD Cards */}
        <section className="hud-grid">
          <div className={`hud-card ${getRiskCardClass(analysis?.riskLevel)}`}>
            <div className="hud-card-top">
              <span className="hud-label">Risk Score</span>
              {analysis && (
                <span className={`risk-level-tag ${getRiskTagClass(analysis.riskLevel)}`}>
                  {analysis.riskLevel}
                </span>
              )}
            </div>
            <div className="hud-value">
              {analysis ? analysis.riskScore : '--'}
              <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}> / 100</span>
            </div>
            <div className="hud-subtext">
              <span>{analysis ? `${analysis.riskLevel} architectural risk` : 'Awaiting analysis'}</span>
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-card-top">
              <span className="hud-label">Blast Radius</span>
              <div className="hud-icon-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                ◈
              </div>
            </div>
            <div className="hud-value">
              {analysis ? analysis.affectedFiles : '--'}
              <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}> files</span>
            </div>
            <div className="hud-subtext">
              <span>{analysis ? `${analysis.summary.directAffectedCount} direct · ${analysis.summary.indirectAffectedCount} indirect` : 'Downstream impact'}</span>
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-card-top">
              <span className="hud-label">Propagation Depth</span>
              <div className="hud-icon-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                ⤹
              </div>
            </div>
            <div className="hud-value">
              {analysis ? `${analysis.summary.maxImpactDepth}` : '--'}
              <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}> hops</span>
            </div>
            <div className="hud-subtext">
              <span>Max reverse dependency distance</span>
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-card-top">
              <span className="hud-label">Analysis Speed</span>
              <div className="hud-icon-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                ⚡
              </div>
            </div>
            <div className="hud-value" style={{ color: '#34d399' }}>
              {analysis?.executionTimeMs !== undefined ? `${analysis.executionTimeMs}` : '--'}
              <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}> ms</span>
            </div>
            <div className="hud-subtext">
              <span>Static AST & BFS graph cycle-safe</span>
            </div>
          </div>
        </section>

        {/* Content Panels Grid */}
        <section className="panels-grid">
          {/* Panel 1: Risk Overview & Breakdown */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>🛡 Risk Factor Breakdown</span>
              </div>
              <span className="panel-meta">Weighted Heuristic Model</span>
            </div>

            {analysis ? (
              <div className="factor-list">
                <div className="factor-item">
                  <div className="factor-row">
                    <span className="factor-name">Blast Radius (Affected Files)</span>
                    <span className="factor-pts">{analysis.summary.breakdown.blastRadiusPoints} / 35 pts</span>
                  </div>
                  <div className="factor-bar-track">
                    <div
                      className="factor-bar-fill"
                      style={{
                        width: `${(analysis.summary.breakdown.blastRadiusPoints / 35) * 100}%`,
                        background: 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="factor-item">
                  <div className="factor-row">
                    <span className="factor-name">Dependency Depth</span>
                    <span className="factor-pts">{analysis.summary.breakdown.depthPoints} / 20 pts</span>
                  </div>
                  <div className="factor-bar-track">
                    <div
                      className="factor-bar-fill"
                      style={{
                        width: `${(analysis.summary.breakdown.depthPoints / 20) * 100}%`,
                        background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="factor-item">
                  <div className="factor-row">
                    <span className="factor-name">Module Criticality (Security/Auth)</span>
                    <span className="factor-pts">{analysis.summary.breakdown.criticalityPoints} / 20 pts</span>
                  </div>
                  <div className="factor-bar-track">
                    <div
                      className="factor-bar-fill"
                      style={{
                        width: `${(analysis.summary.breakdown.criticalityPoints / 20) * 100}%`,
                        background: 'linear-gradient(90deg, #8b5cf6 0%, #c084fc 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="factor-item">
                  <div className="factor-row">
                    <span className="factor-name">Change Volume</span>
                    <span className="factor-pts">{analysis.summary.breakdown.changeSizePoints} / 15 pts</span>
                  </div>
                  <div className="factor-bar-track">
                    <div
                      className="factor-bar-fill"
                      style={{
                        width: `${(analysis.summary.breakdown.changeSizePoints / 15) * 100}%`,
                        background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="factor-item">
                  <div className="factor-row">
                    <span className="factor-name">Test Verification Factor</span>
                    <span className="factor-pts">{analysis.summary.breakdown.testCoveragePoints} / 10 pts</span>
                  </div>
                  <div className="factor-bar-track">
                    <div
                      className="factor-bar-fill"
                      style={{
                        width: `${(analysis.summary.breakdown.testCoveragePoints / 10) * 100}%`,
                        background: 'linear-gradient(90deg, #6366f1 0%, #a5b4fc 100%)',
                      }}
                    />
                  </div>
                </div>

                {/* Reviewer Verdict Callout */}
                <div className="verdict-callout">
                  <div className="verdict-header" style={{ color: analysis.riskScore >= 70 ? '#f43f5e' : analysis.riskScore >= 40 ? '#f59e0b' : '#10b981' }}>
                    {analysis.riskScore >= 70 ? '● High Risk: Multi-Reviewer Sign-off Recommended' : analysis.riskScore >= 40 ? '● Moderate Risk: Downstream Verification Needed' : '● Low Risk: Isolated Change'}
                  </div>
                  <div className="verdict-text">
                    {analysis.reasons.slice(0, 3).map((r, i) => (
                      <div key={i} className="reason-tag">
                        <span className="reason-bullet-point">▸</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="factor-list" style={{ justifyContent: 'center', alignItems: 'center', flex: 1, color: '#64748b' }}>
                Waiting for pull request analysis...
              </div>
            )}
          </div>

          {/* Panel 2: Interactive Dependency Graph */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>◈ Dependency Blast-Radius Graph</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={() => setGraphMode('3d')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: graphMode === '3d' ? '#6366f1' : 'transparent',
                      color: graphMode === '3d' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    3D Orbit
                  </button>
                  <button
                    onClick={() => setGraphMode('2d')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: graphMode === '2d' ? '#6366f1' : 'transparent',
                      color: graphMode === '2d' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    2D View
                  </button>
                </div>
                <span className="panel-meta">
                  {analysis ? `${analysis.files.length} nodes · ${analysis.dependencies.length} edges` : ''}
                </span>
              </div>
            </div>

            {analysis ? (
              <div className="graph-canvas-container">
                {graphMode === '3d' ? (
                  <Graph3D
                    files={analysis.files}
                    dependencies={analysis.dependencies}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                  />
                ) : (
                  <svg className="graph-canvas" viewBox="0 0 460 220">
                  <defs>
                    <marker id="arrow-head" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
                    </marker>
                    <marker id="arrow-head-active" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8b5cf6" />
                    </marker>
                  </defs>

                  {/* Edges */}
                  {analysis.dependencies.map((edge, idx) => {
                    const sourceIdx = analysis.files.findIndex((f) => f.path === edge.source);
                    const targetIdx = analysis.files.findIndex((f) => f.path === edge.target);

                    const x1 = 80 + (sourceIdx >= 0 ? (sourceIdx % 3) * 150 : 80);
                    const y1 = 55 + Math.floor(sourceIdx / 3) * 85;
                    const x2 = 80 + (targetIdx >= 0 ? (targetIdx % 3) * 150 : 380);
                    const y2 = 55 + Math.floor(targetIdx / 3) * 85;

                    const isHighlighted = selectedFile && (edge.source === selectedFile.path || edge.target === selectedFile.path);

                    return (
                      <path
                        key={idx}
                        d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                        stroke={isHighlighted ? '#8b5cf6' : '#334155'}
                        strokeWidth={isHighlighted ? '2.5' : '1.5'}
                        strokeDasharray={isHighlighted ? 'none' : '4'}
                        fill="none"
                        markerEnd={isHighlighted ? 'url(#arrow-head-active)' : 'url(#arrow-head)'}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {analysis.files.map((file, idx) => {
                    const x = 80 + (idx % 3) * 150;
                    const y = 55 + Math.floor(idx / 3) * 85;

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
                        className="node-group"
                        onClick={() => setSelectedFile(file)}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 22 : 18}
                          fill={fill}
                          stroke={isSelected ? '#ffffff' : stroke}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <text
                          x={x}
                          y={y + 4}
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="700"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {file.path.split('/').pop()?.slice(0, 10)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                )}

                {/* Selected Node Details Card */}
                {selectedFile && (
                  <div className="node-inspector-card">
                    <div>
                      <div className="inspector-path">{selectedFile.path}</div>
                      <div className="inspector-sub">
                        {selectedFile.reasons[0] || 'Selected repository module'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="risk-num" style={{ color: selectedFile.riskScore >= 70 ? '#f43f5e' : selectedFile.riskScore >= 40 ? '#fbbf24' : '#10b981' }}>
                        Risk: {selectedFile.riskScore}
                      </span>
                      {getStatusBadge(selectedFile.status)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b' }}>
                Dependency graph will appear here.
              </div>
            )}
          </div>

          {/* Panel 3: Affected Files Explorer */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>📂 Repository Files & Impact</span>
              </div>
              <span className="panel-meta">{filteredFiles.length} listed</span>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
              <button
                className={`filter-tab ${fileFilter === 'all' ? 'active' : ''}`}
                onClick={() => setFileFilter('all')}
              >
                All ({analysis?.files.length || 0})
              </button>
              <button
                className={`filter-tab ${fileFilter === 'changed' ? 'active' : ''}`}
                onClick={() => setFileFilter('changed')}
              >
                Changed ({analysis?.files.filter((f) => f.status === 'changed').length || 0})
              </button>
              <button
                className={`filter-tab ${fileFilter === 'direct' ? 'active' : ''}`}
                onClick={() => setFileFilter('direct')}
              >
                Direct ({analysis?.files.filter((f) => f.status === 'direct_affected').length || 0})
              </button>
              <button
                className={`filter-tab ${fileFilter === 'indirect' ? 'active' : ''}`}
                onClick={() => setFileFilter('indirect')}
              >
                Indirect ({analysis?.files.filter((f) => f.status === 'indirect_affected').length || 0})
              </button>
              <button
                className={`filter-tab ${fileFilter === 'safe' ? 'active' : ''}`}
                onClick={() => setFileFilter('safe')}
              >
                Safe ({analysis?.files.filter((f) => f.status === 'unaffected').length || 0})
              </button>
            </div>

            {analysis ? (
              <div className="file-table">
                {filteredFiles.map((file) => {
                  const ext = file.path.endsWith('.ts') || file.path.endsWith('.tsx') ? 'ts' : 'js';
                  const isSelected = selectedFile?.path === file.path;

                  return (
                    <div
                      key={file.path}
                      className={`file-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="file-path-col">
                        <span className={`file-ext-icon ${ext === 'ts' ? 'icon-ts' : 'icon-js'}`}>{ext}</span>
                        <span>{file.path}</span>
                      </div>
                      <div className="file-meta-col">
                        <span className="depth-indicator">
                          {file.impactDepth >= 0 ? `${file.impactDepth} hops` : 'safe'}
                        </span>
                        <span
                          className="risk-num"
                          style={{
                            color: file.riskScore >= 70 ? '#f43f5e' : file.riskScore >= 40 ? '#fbbf24' : '#10b981',
                          }}
                        >
                          {file.riskScore}
                        </span>
                        {getStatusBadge(file.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b' }}>
                Files will appear here.
              </div>
            )}
          </div>

          {/* Panel 4: Dependency Edges & Audit Log */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>⇄ Dependency Resolution Matrix</span>
              </div>
              <span className="panel-meta">{analysis?.dependencies.length || 0} resolved edges</span>
            </div>

            {analysis ? (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="edge-matrix">
                  <thead>
                    <tr>
                      <th>Importer File (Dependent)</th>
                      <th>Target File (Dependency)</th>
                      <th>Import Specifier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.dependencies.map((edge, idx) => (
                      <tr key={idx}>
                        <td style={{ color: '#c4b5fd' }}>{edge.source}</td>
                        <td style={{ color: '#fb7185' }}>{edge.target}</td>
                        <td style={{ color: '#94a3b8' }}>{edge.importPath}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {analysis.warnings.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', fontSize: '11.5px', color: '#fef08a' }}>
                    <strong>Parser & Resolution Warnings:</strong>
                    <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                      {analysis.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b' }}>
                Audit matrix will appear here.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
