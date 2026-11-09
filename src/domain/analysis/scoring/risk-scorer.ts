import { isTestFile } from '../parser/file-types.js';
import {
  AnalysisFileResult,
  ChangedFileObject,
  RiskLevel,
  RiskScoreBreakdown,
  RiskWeights,
} from '../types.js';
import { TraversalResult } from '../blast-radius/traversal.js';
import { DependencyGraph } from '../graph/dependency-graph.js';

export const HIGH_CRITICALITY_PATTERNS = [
  /(?:^|\/)(?:auth|security|login|token|session|permission|credential|crypto|payment|billing|checkout)(?:[._\/-]|\.|$)/i,
  /(?:^|\/)api\/v\d+\//i,
];

export const MEDIUM_CRITICALITY_PATTERNS = [
  /(?:^|\/)(?:config|schema|database|db|migration|models|types)(?:[._\/-]|\.|$)/i,
];

export interface ScoreCalculationInput {
  traversal: TraversalResult;
  graph: DependencyGraph;
  changedFileMetadata: Map<string, ChangedFileObject>;
  weights?: RiskWeights;
  customSensitivePatterns?: string[];
}

export interface ScoreCalculationResult {
  riskScore: number;
  riskLevel: RiskLevel;
  breakdown: RiskScoreBreakdown;
  reasons: string[];
  fileScores: Map<string, number>;
}

export function calculateRiskScore(input: ScoreCalculationInput): ScoreCalculationResult {
  const { traversal, graph, changedFileMetadata } = input;

  const directCount = traversal.directAffected.length;
  const indirectCount = traversal.indirectAffected.length;
  const totalAffected = directCount + indirectCount;
  const maxDepth = traversal.maxImpactDepth;

  const reasons: string[] = [];

  // 1. Blast Radius Points (max 35-40 pts)
  // 5 pts per direct affected, 2 pts per indirect affected, capped at 35
  const rawBlastRadius = directCount * 5 + indirectCount * 2;
  const blastRadiusPoints = Math.min(35, rawBlastRadius);

  if (totalAffected >= 10) {
    reasons.push(`High dependency blast radius: ${totalAffected} files affected (${directCount} direct, ${indirectCount} indirect)`);
  } else if (totalAffected > 0) {
    reasons.push(`${totalAffected} downstream file(s) affected by this change`);
  } else {
    reasons.push('Isolated change: no downstream dependent files identified');
  }

  if (directCount >= 3) {
    reasons.push('Multiple downstream dependencies directly import modified code');
  }

  // 2. Dependency Depth Points (max 20 pts)
  // 5 pts per depth level
  const depthPoints = Math.min(20, maxDepth * 5);
  if (maxDepth >= 3) {
    reasons.push(`Deep dependency propagation: impact extends ${maxDepth} levels into the codebase`);
  } else if (maxDepth >= 1) {
    reasons.push(`Dependency impact depth: ${maxDepth} level(s)`);
  }

  // 3. Module Criticality Points (0, 10, or 20 pts)
  let criticalityPoints = 0;
  const criticalFiles: string[] = [];

  const checkCriticality = (filePath: string): number => {
    for (const pat of HIGH_CRITICALITY_PATTERNS) {
      if (pat.test(filePath)) return 20;
    }
    for (const pat of MEDIUM_CRITICALITY_PATTERNS) {
      if (pat.test(filePath)) return 10;
    }
    return 0;
  };

  // Inspect changed files for criticality
  for (const file of traversal.changedFiles) {
    const level = checkCriticality(file);
    if (level === 20) {
      criticalityPoints = Math.max(criticalityPoints, 20);
      criticalFiles.push(file);
    } else if (level === 10) {
      criticalityPoints = Math.max(criticalityPoints, 10);
      criticalFiles.push(file);
    }
  }

  // Also inspect direct affected files (they directly interface with the changed file)
  for (const file of traversal.directAffected) {
    const level = checkCriticality(file);
    if (level === 20 && criticalityPoints < 20) {
      criticalityPoints = Math.max(criticalityPoints, 15);
      criticalFiles.push(file);
    }
  }

  if (criticalityPoints >= 15) {
    reasons.push(`Changes affect authentication, security, or critical core module(s)`);
  } else if (criticalityPoints === 10) {
    reasons.push(`Changes touch configuration, data models, or shared types`);
  }

  // 4. Change Size Points (max 15 pts)
  let totalLinesChanged = 0;
  let hasLineStats = false;

  for (const [_path, meta] of changedFileMetadata) {
    if (meta.additions !== undefined || meta.deletions !== undefined) {
      hasLineStats = true;
      totalLinesChanged += (meta.additions || 0) + (meta.deletions || 0);
    }
  }

  let changeSizePoints = 0;
  if (hasLineStats && totalLinesChanged > 0) {
    // 5 pts per 50 lines changed, up to 15
    changeSizePoints = Math.min(15, Math.ceil(totalLinesChanged / 50) * 5);
    if (totalLinesChanged >= 150) {
      reasons.push(`Large diff size: ~${totalLinesChanged} lines modified across PR`);
    }
  } else {
    // Estimate from changed files count
    changeSizePoints = Math.min(15, traversal.changedFiles.length * 5);
    if (traversal.changedFiles.length >= 3) {
      reasons.push(`Broad change: ${traversal.changedFiles.length} files modified in PR`);
    }
  }

  // 5. Test Coverage / Verification factor (max 10 pts)
  // Check if test files are modified in PR or exist for changed files
  let testCoveragePoints = 10; // Default assumption: tests need review
  const hasTestsChanged = traversal.changedFiles.some((f) => isTestFile(f));
  const hasTestsInGraph = graph.getAllNodes().some((n) => isTestFile(n.filePath));

  if (hasTestsChanged) {
    testCoveragePoints = 0; // PR includes test updates
    reasons.push('PR includes corresponding test file updates');
  } else if (hasTestsInGraph) {
    testCoveragePoints = 5;
    reasons.push('Tests exist in repository but were not updated in this PR');
  } else {
    testCoveragePoints = 10;
    reasons.push('No automated test updates detected for modified modules');
  }

  // Calculate total raw score (0 - 100)
  const total = Math.min(
    100,
    blastRadiusPoints +
      depthPoints +
      criticalityPoints +
      changeSizePoints +
      testCoveragePoints
  );

  const riskScore = Math.round(total);

  // Map to RiskLevel
  let riskLevel: RiskLevel = 'LOW';
  if (riskScore >= 75) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 25) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // Calculate per-file risk scores for Person 3 dashboard
  const fileScores = new Map<string, number>();

  for (const changedFile of traversal.changedFiles) {
    const dependentsCount = graph.getDirectDependents(changedFile).length;
    const baseChangedScore = Math.min(98, 70 + dependentsCount * 5 + (checkCriticality(changedFile) > 0 ? 15 : 0));
    fileScores.set(changedFile, baseChangedScore);
  }

  for (const direct of traversal.directAffected) {
    const downstream = graph.getDirectDependents(direct).length;
    const directScore = Math.min(90, 50 + downstream * 5 + (checkCriticality(direct) > 0 ? 10 : 0));
    fileScores.set(direct, directScore);
  }

  for (const indirect of traversal.indirectAffected) {
    const depth = traversal.impactDepth.get(indirect) || 2;
    const indirectScore = Math.max(20, Math.min(65, 45 - depth * 5));
    fileScores.set(indirect, indirectScore);
  }

  for (const unaffected of traversal.unaffected) {
    fileScores.set(unaffected, 0);
  }

  const breakdown: RiskScoreBreakdown = {
    blastRadiusPoints,
    depthPoints,
    criticalityPoints,
    changeSizePoints,
    testCoveragePoints,
    total: riskScore,
  };

  return {
    riskScore,
    riskLevel,
    breakdown,
    reasons,
    fileScores,
  };
}

/**
 * Builds structured file list for Person 3 dashboard.
 */
export function buildAnalysisFiles(
  traversal: TraversalResult,
  fileScores: Map<string, number>,
  changedFileMetadata: Map<string, ChangedFileObject>
): AnalysisFileResult[] {
  const results: AnalysisFileResult[] = [];

  // Changed files
  for (const changed of traversal.changedFiles) {
    const meta = changedFileMetadata.get(changed);
    results.push({
      path: changed,
      type: 'changed',
      status: 'changed',
      riskScore: fileScores.get(changed) ?? 75,
      impactDepth: 0,
      reasons: traversal.reasons.get(changed) || ['Directly modified in PR'],
      prStatus: meta?.status || 'modified',
    });
  }

  // Direct affected files
  for (const direct of traversal.directAffected) {
    results.push({
      path: direct,
      type: 'affected',
      status: 'direct_affected',
      riskScore: fileScores.get(direct) ?? 60,
      impactDepth: traversal.impactDepth.get(direct) ?? 1,
      reasons: traversal.reasons.get(direct) || ['Directly affected'],
    });
  }

  // Indirect affected files
  for (const indirect of traversal.indirectAffected) {
    results.push({
      path: indirect,
      type: 'affected',
      status: 'indirect_affected',
      riskScore: fileScores.get(indirect) ?? 35,
      impactDepth: traversal.impactDepth.get(indirect) ?? 2,
      reasons: traversal.reasons.get(indirect) || ['Transitively affected'],
    });
  }

  // Unaffected files
  for (const unaffected of traversal.unaffected) {
    results.push({
      path: unaffected,
      type: 'unaffected',
      status: 'unaffected',
      riskScore: 0,
      impactDepth: -1,
      reasons: ['No dependency path to changed files'],
    });
  }

  return results;
}
