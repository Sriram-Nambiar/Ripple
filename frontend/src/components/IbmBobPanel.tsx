import React, { useState } from 'react';

export interface BobRemediationPatch {
  filePath: string;
  impactType: 'direct_affected' | 'indirect_affected' | 'changed';
  suggestedAction: string;
  patchDiff: string;
  explanation: string;
  suggestedTest: string;
}

export interface BobAnalysisOutput {
  model: string;
  engine: string;
  verdict: string;
  executiveSummary: string;
  architecturalRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  remediationPlan: {
    step: number;
    action: string;
    targetFiles: string[];
    details: string;
  }[];
  remediationPatches: BobRemediationPatch[];
  testShield: {
    recommendedTestFiles: string[];
    generatedTestSuite: string;
  };
  governanceChecklist: {
    item: string;
    status: 'pass' | 'warning' | 'requires_action';
    notes: string;
  }[];
}

interface IbmBobPanelProps {
  bob?: BobAnalysisOutput;
  selectedFile: any;
  analysis: any;
  onSelectFile?: (file: any) => void;
}

export const IbmBobPanel: React.FC<IbmBobPanelProps> = ({
  bob,
  selectedFile,
  analysis,
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'code' | 'test' | 'ask'>('plan');
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [codeSnippet, setCodeSnippet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!bob && !analysis) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        Waiting for analysis to activate IBM Bob...
      </div>
    );
  }

  // Active patch for selected file or default first patch
  const activePatch =
    (selectedFile && bob?.remediationPatches.find((p) => p.filePath === selectedFile.path)) ||
    (bob?.remediationPatches && bob.remediationPatches[0]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAskBob = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    setChatLoading(true);
    setChatAnswer(null);
    setCodeSnippet(null);

    try {
      const res = await fetch('/api/v1/bob/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          analysis,
          selectedFile: selectedFile?.path,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setChatAnswer(json.data.answer);
        setSuggestedActions(json.data.suggestedActions || []);
        setCodeSnippet(json.data.codeSnippet || null);
      } else {
        setChatAnswer('IBM Bob: Unable to complete reasoning query. Please retry.');
      }
    } catch {
      setChatAnswer('IBM Bob: Network connection error to agent service.');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        border: '1px solid rgba(99, 102, 241, 0.35)',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.4) 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)',
      }}
    >
      {/* Header Bar */}
      <div
        className="panel-header"
        style={{
          borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
          paddingBottom: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0f62fe 0%, #8a3ffc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 0 12px rgba(15, 98, 254, 0.5)',
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                IBM Bob AI Agent Hub
              </span>
              <span
                style={{
                  background: 'rgba(15, 98, 254, 0.2)',
                  border: '1px solid rgba(15, 98, 254, 0.4)',
                  color: '#78a9ff',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                IBM Granite 3.0
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Autonomous Blast-Radius Remediation & Regression Test Synthesis
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setActiveTab('plan')}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: activeTab === 'plan' ? '#6366f1' : 'transparent',
              color: activeTab === 'plan' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            📋 Plan Mode
          </button>
          <button
            onClick={() => setActiveTab('code')}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: activeTab === 'code' ? '#6366f1' : 'transparent',
              color: activeTab === 'code' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            🛠 Remediation Patches
          </button>
          <button
            onClick={() => setActiveTab('test')}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: activeTab === 'test' ? '#6366f1' : 'transparent',
              color: activeTab === 'test' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            🛡 Test Shield
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: activeTab === 'ask' ? '#6366f1' : 'transparent',
              color: activeTab === 'ask' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            💬 Ask Bob
          </button>
        </div>
      </div>

      {/* TAB 1: ARCHITECTURAL PLAN */}
      {activeTab === 'plan' && bob && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Executive Verdict Callout */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background:
                bob.architecturalRisk === 'CRITICAL' || bob.architecturalRisk === 'HIGH'
                  ? 'rgba(244, 63, 94, 0.12)'
                  : bob.architecturalRisk === 'MEDIUM'
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(16, 185, 129, 0.12)',
              border:
                bob.architecturalRisk === 'CRITICAL' || bob.architecturalRisk === 'HIGH'
                  ? '1px solid rgba(244, 63, 94, 0.3)'
                  : bob.architecturalRisk === 'MEDIUM'
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc', marginBottom: '4px' }}>
              {bob.verdict}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
              {bob.executiveSummary}
            </div>
          </div>

          {/* Remediation Step Grid */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Step-by-Step Merge Mitigation Plan
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {bob.remediationPlan.map((s) => (
                <div
                  key={s.step}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span
                      style={{
                        background: '#6366f1',
                        color: '#fff',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {s.step}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>{s.action}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>{s.details}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Governance Checklist */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              IBM Enterprise Governance & Policy Checklist
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {bob.governanceChecklist.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        color:
                          item.status === 'pass' ? '#34d399' : item.status === 'warning' ? '#fbbf24' : '#f43f5e',
                        fontWeight: 700,
                      }}
                    >
                      {item.status === 'pass' ? '✓' : item.status === 'warning' ? '⚠' : '✕'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500 }}>{item.item}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.notes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REMEDIATION PATCHES */}
      {activeTab === 'code' && bob && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activePatch ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                    Remediation Patch for <code>{activePatch.filePath}</code>
                  </span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {activePatch.explanation}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(activePatch.patchDiff, 'patch')}
                  style={{
                    background: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid #6366f1',
                    color: '#c7d2fe',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {copied === 'patch' ? '✓ Copied Diff!' : '📋 Copy Patch Diff'}
                </button>
              </div>

              <pre
                style={{
                  background: '#090d16',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '12px',
                  color: '#7dd3fc',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  lineHeight: '1.5',
                }}
              >
                {activePatch.patchDiff}
              </pre>

              {/* Suggested Test for this file */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                  Targeted Assertion for {activePatch.filePath.split('/').pop()}:
                </div>
                <pre
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#34d399',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                  }}
                >
                  {activePatch.suggestedTest}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>
              Select an affected node in the 3D graph or file explorer to inspect IBM Bob's custom remediation patch.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEST SHIELD */}
      {activeTab === 'test' && bob && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                Automated Vitest / Jest Pre-Merge Regression Shield
              </span>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Synthesized by IBM Bob to prevent downstream regressions across {bob.testShield.recommendedTestFiles.length} key affected paths.
              </div>
            </div>
            <button
              onClick={() => handleCopy(bob.testShield.generatedTestSuite, 'test-suite')}
              style={{
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {copied === 'test-suite' ? '✓ Copied Suite!' : '📋 Copy Test Suite'}
            </button>
          </div>

          <pre
            style={{
              background: '#090d16',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '11px',
              color: '#34d399',
              fontFamily: 'monospace',
              maxHeight: '220px',
              overflowY: 'auto',
              lineHeight: '1.5',
            }}
          >
            {bob.testShield.generatedTestSuite}
          </pre>
        </div>
      )}

      {/* TAB 4: ASK BOB INTERACTIVE CHAT */}
      {activeTab === 'ask' && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Quick Query Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              selectedFile ? `Why is ${selectedFile.path.split('/').pop()} affected?` : 'Why is the blast radius high?',
              'Generate regression test shield',
              'What is the recommended rollout plan?',
              'How to ensure backwards compatibility?',
            ].map((promptText, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuestion(promptText);
                  handleAskBob(promptText);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Input & Ask Button */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskBob()}
              placeholder="Ask IBM Bob anything about this PR's blast radius or refactoring..."
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleAskBob()}
              disabled={chatLoading}
              style={{
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: chatLoading ? 'wait' : 'pointer',
              }}
            >
              {chatLoading ? 'Reasoning...' : 'Ask Bob'}
            </button>
          </div>

          {/* AI Response Output */}
          {chatAnswer && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.9)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                fontSize: '12px',
                color: '#e2e8f0',
                lineHeight: '1.6',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{chatAnswer}</div>

              {codeSnippet && (
                <pre
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: '#090d16',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                  }}
                >
                  {codeSnippet}
                </pre>
              )}

              {suggestedActions.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {suggestedActions.map((action, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#c7d2fe',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 500,
                      }}
                    >
                      ▹ {action}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
