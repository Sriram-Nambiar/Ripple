import { analyzeRepository } from '../src/domain/analysis/analyzer.js';
import { generateBobAnalysis } from '../src/domain/bob/bob-agent.js';
import { fetchGitHubPullRequest, getGitHubToken, parseGitHubPrUrl } from '../src/domain/github/github-fetcher.js';
import { execSync } from 'node:child_process';

interface PrBotOptions {
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  token?: string;
}

/**
 * Parses arguments from CLI or GitHub Actions environment
 */
function resolvePrTarget(): PrBotOptions {
  const args = process.argv.slice(2);
  let prArg: string | null = null;
  let repoArg: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pr' && args[i + 1]) {
      prArg = args[i + 1];
      i++;
    } else if (args[i] === '--repo' && args[i + 1]) {
      repoArg = args[i + 1];
      i++;
    }
  }

  // Check env vars (GitHub Actions standard variables)
  const envPrNumber = process.env.PR_NUMBER || process.env.GITHUB_PR_NUMBER;
  const envRepo = process.env.GITHUB_REPOSITORY || process.env.REPO_FULL_NAME;

  let owner = 'harsh200623';
  let repo = 'Ripple';
  let prNumber = 0;

  if (prArg) {
    const parsed = parseGitHubPrUrl(prArg);
    if (parsed) {
      return {
        owner: parsed.owner,
        repo: parsed.repo,
        prNumber: parsed.number,
        prUrl: parsed.url,
      };
    }
    // Might just be a number: e.g. --pr 3
    const num = parseInt(prArg, 10);
    if (!isNaN(num)) {
      prNumber = num;
    }
  }

  if (envPrNumber) {
    const parsedNum = parseInt(envPrNumber, 10);
    if (!isNaN(parsedNum)) {
      prNumber = parsedNum;
    }
  }

  if (repoArg && repoArg.includes('/')) {
    const [o, r] = repoArg.split('/');
    if (o && r) {
      owner = o;
      repo = r;
    }
  } else if (envRepo && envRepo.includes('/')) {
    const [o, r] = envRepo.split('/');
    if (o && r) {
      owner = o;
      repo = r;
    }
  }

  if (!prNumber) {
    throw new Error(
      'Missing PR target. Provide --pr <url_or_number> or set PR_NUMBER environment variable.\nExample: npx tsx scripts/pr-bot.ts --pr 2'
    );
  }

  return {
    owner,
    repo,
    prNumber,
    prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
  };
}

/**
 * Builds the Markdown report body with tables, metrics, and Mermaid graph
 */
function generatePrCommentBody(
  analysis: any,
  prMeta: { number: number; title: string; url: string; owner: string; repo: string },
  bob?: any
): string {
  const { summary, riskScore, riskLevel, files, dependencies, reasons, warnings, executionTimeMs } = analysis;

  const webBaseUrl = (
    process.env.RIPPLE_WEB_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://ripple-y3zm.onrender.com'
  ).replace(/\/$/, '');
  const dashboardUrl = `${webBaseUrl}/?pr=${encodeURIComponent(prMeta.url)}`;

  const levelEmoji =
    riskLevel === 'CRITICAL' ? '🚨' : riskLevel === 'HIGH' ? '🔴' : riskLevel === 'MEDIUM' ? '🟠' : '🟢';

  const verdictText =
    riskScore >= 70
      ? '⚠️ **High Architectural Risk:** Core systems modified. Multi-reviewer sign-off recommended.'
      : riskScore >= 40
      ? '⚡ **Moderate Risk:** Changes propagate to multiple dependent files. Verify interface contracts.'
      : '✅ **Low Architectural Risk:** Changes are isolated with minimal or zero downstream blast radius.';

  // Build Mermaid graph (up to 12 edges)
  let mermaidBlock = '';
  if (dependencies && dependencies.length > 0) {
    const lines: string[] = ['```mermaid', 'graph LR'];
    const activeNodes = new Set<string>();

    dependencies.slice(0, 12).forEach((edge: any) => {
      const srcId = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
      const tgtId = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
      const srcName = edge.source.split('/').pop() || edge.source;
      const tgtName = edge.target.split('/').pop() || edge.target;

      lines.push(`  ${srcId}["${srcName}"] --> ${tgtId}["${tgtName}"]`);
      activeNodes.add(edge.source);
      activeNodes.add(edge.target);
    });

    files.forEach((f: any) => {
      if (activeNodes.has(f.path)) {
        const id = f.path.replace(/[^a-zA-Z0-9_]/g, '_');
        if (f.status === 'changed') {
          lines.push(`  style ${id} fill:#f43f5e,stroke:#9f1239,stroke-width:2px,color:#fff`);
        } else if (f.status === 'direct_affected') {
          lines.push(`  style ${id} fill:#f59e0b,stroke:#78350f,stroke-width:2px,color:#fff`);
        } else if (f.status === 'indirect_affected') {
          lines.push(`  style ${id} fill:#818cf8,stroke:#312e81,stroke-width:1px,color:#fff`);
        }
      }
    });

    lines.push('```');
    mermaidBlock = lines.join('\n');
  }

  // Build Impacted Files table
  const affectedList = files.filter((f: any) => f.status !== 'unaffected');
  const filesTableRows = affectedList
    .slice(0, 15)
    .map((f: any) => {
      const statusIcon =
        f.status === 'changed'
          ? '🔴 `changed`'
          : f.status === 'direct_affected'
          ? '🟠 `direct`'
          : '🔵 `indirect`';
      const reasonStr = f.reasons && f.reasons.length > 0 ? f.reasons[0] : '--';
      return `| \`${f.path}\` | ${statusIcon} | **${f.riskScore}** | ${f.impactDepth} | ${reasonStr} |`;
    })
    .join('\n');

  const bd = summary.breakdown;

  const bobVerdict = bob?.verdict || verdictText;
  const bobSteps = bob?.remediationPlan
    ? bob.remediationPlan.slice(0, 3).map((s: any) => `${s.step}. **${s.action}:** ${s.details}`).join('\n')
    : '';

  return `<!-- ripple-pr-impact-radar -->
## 🌊 Ripple · Pull Request Impact Radar
*Powered by **IBM Bob AI Partner (IBM Granite 3.0)***

> 🚀 **[Open Interactive 3D Blast-Radius & IBM Bob Remediation Hub →](${dashboardUrl})**

### 🚦 Risk Evaluation: ${levelEmoji} **${riskLevel} RISK (${riskScore}/100)**
> **🤖 IBM Bob AI Verdict:** ${bobVerdict}

| 🎯 Changed Files | 💥 Blast Radius | ⤹ Max Depth | ⚡ Analysis Speed |
| :---: | :---: | :---: | :---: |
| **${summary.changedFileCount}** | **${summary.totalAffectedCount} downstream** (${summary.directAffectedCount} direct, ${summary.indirectAffectedCount} indirect) | **${summary.maxImpactDepth} hops** | **${executionTimeMs || '< 20'} ms** |

${bobSteps ? `### 🤖 IBM Bob Architectural Remediation Plan\n${bobSteps}\n` : ''}

${reasons.slice(0, 3).map((r: string) => `- ▹ ${r}`).join('\n')}

<details>
<summary><b>💥 View Impacted Files Breakdown (${affectedList.length} files)</b></summary>

| File Path | Status | Risk Score | Depth | Primary Impact Reason |
| :--- | :---: | :---: | :---: | :--- |
${filesTableRows}
${affectedList.length > 15 ? `\n*...and ${affectedList.length - 15} more files. [See all in Dashboard](${dashboardUrl})*` : ''}

</details>

<details>
<summary><b>📊 View Risk Scoring Breakdown</b></summary>

| Factor | Points | Weight | Assessment |
| :--- | :---: | :---: | :--- |
| **Blast Radius** | \`${bd.blastRadiusPoints} / 35\` | 35% | ${summary.totalAffectedCount} downstream files affected |
| **Propagation Depth** | \`${bd.depthPoints} / 20\` | 20% | Maximum cascade reaches ${summary.maxImpactDepth} levels |
| **Module Criticality** | \`${bd.criticalityPoints} / 20\` | 20% | Criticality of touched code paths |
| **Change Volume** | \`${bd.changeSizePoints} / 15\` | 15% | Lines modified across pull request |
| **Test Verification** | \`${bd.testCoveragePoints} / 10\` | 10% | Presence of matching test coverage |

</details>

${
  mermaidBlock
    ? `<details>
<summary><b>🔗 View Dependency Graph Diagram</b></summary>

${mermaidBlock}

</details>`
    : ''
}

---
<sub>⚡ [Open full 3D interactive model & code inspector in Ripple Dashboard](${dashboardUrl})</sub>
`;
}

/**
 * Posts or updates comment on GitHub PR
 */
async function postOrUpdateComment(options: PrBotOptions, commentBody: string): Promise<string> {
  const token = getGitHubToken();
  const headers: Record<string, string> = {
    'User-Agent': 'Ripple-PR-Radar-Bot/1.0',
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Check existing comments on the PR for our bot identifier
  const commentsUrl = `https://api.github.com/repos/${options.owner}/${options.repo}/issues/${options.prNumber}/comments`;
  let existingCommentId: number | null = null;

  try {
    const res = await fetch(commentsUrl, { headers });
    if (res.ok) {
      const comments = (await res.json()) as any[];
      const botComment = comments.find((c) => c.body && c.body.includes('<!-- ripple-pr-impact-radar -->'));
      if (botComment) {
        existingCommentId = botComment.id;
      }
    }
  } catch (err) {
    console.warn('Could not list PR comments via API:', err);
  }

  // 2. Update existing comment or create a new one
  if (existingCommentId) {
    const updateUrl = `https://api.github.com/repos/${options.owner}/${options.repo}/issues/comments/${existingCommentId}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: commentBody }),
    });

    if (updateRes.ok) {
      const data = (await updateRes.json()) as any;
      return data.html_url || `${options.prUrl}#issuecomment-${existingCommentId}`;
    }
  }

  // Create new comment
  const createRes = await fetch(commentsUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: commentBody }),
  });

  if (createRes.ok) {
    const data = (await createRes.json()) as any;
    return data.html_url || `${options.prUrl}#issuecomment-${data.id}`;
  }

  // Fallback to gh CLI if REST endpoint encounters permissions issue
  try {
    const tempFile = `.pr-comment-temp-${Date.now()}.md`;
    const fs = await import('node:fs');
    fs.writeFileSync(tempFile, commentBody, 'utf-8');
    execSync(`gh pr comment ${options.prNumber} --repo ${options.owner}/${options.repo} --body-file "${tempFile}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    fs.unlinkSync(tempFile);
    return `${options.prUrl} (posted via gh CLI)`;
  } catch (cliErr: any) {
    throw new Error(`Failed to post comment to PR #${options.prNumber}: ${cliErr?.message || createRes.statusText}`);
  }
}

/**
 * Main execution flow
 */
async function run() {
  console.log('🌊 [Ripple PR Bot] Starting PR Impact Radar analysis...');
  const target = resolvePrTarget();
  const ALLOWED_REPO = 'harsh200623/Ripple';
  const targetRepo = `${target.owner}/${target.repo}`;
  if (targetRepo.toLowerCase() !== ALLOWED_REPO.toLowerCase()) {
    console.log(`🛑 [Ripple PR Bot] Exclusively configured to run on ${ALLOWED_REPO}. Skipped for ${targetRepo}.`);
    process.exit(0);
  }
  console.log(`🎯 Target PR: ${target.owner}/${target.repo}#${target.prNumber} (${target.prUrl})`);

  console.log('📡 Fetching pull request snapshot from GitHub...');
  const prData = await fetchGitHubPullRequest({
    owner: target.owner,
    repo: target.repo,
    number: target.prNumber,
    url: target.prUrl,
  });

  console.log(
    `✓ Fetched PR #${prData.pullRequest.number}: "${prData.pullRequest.title}" (${prData.changedFiles.length} changed files, ${prData.repositoryFiles.length} candidate files)`
  );

  console.log('⚡ Running Core Analysis Engine (AST + Reverse BFS + Risk Scorer)...');
  const startTime = Date.now();
  const analysis = await analyzeRepository({
    repositoryFiles: prData.repositoryFiles,
    changedFiles: prData.changedFiles,
  });
  const duration = Date.now() - startTime;
  analysis.executionTimeMs = duration;

  console.log(`✓ Analysis Complete in ${duration}ms:`);
  console.log(`  - Risk Score: ${analysis.riskScore}/100 (${analysis.riskLevel})`);
  console.log(`  - Changed Files: ${analysis.changedFiles}`);
  console.log(`  - Downstream Blast Radius: ${analysis.affectedFiles}`);
  console.log(`  - Propagation Depth: ${analysis.summary.maxImpactDepth} hops`);

  console.log('🤖 Invoking IBM Bob Agentic Remediation & Test Shield...');
  const bob = await generateBobAnalysis(analysis, prData.changedFiles, prData.repositoryFiles);
  console.log(`✓ IBM Bob synthesized ${bob.remediationPatches.length} remediation patches & regression test shield.`);

  console.log('📝 Generating PR Markdown Report...');
  const commentBody = generatePrCommentBody(analysis, {
    number: target.prNumber,
    title: prData.pullRequest.title,
    url: target.prUrl,
    owner: target.owner,
    repo: target.repo,
  }, bob);

  console.log('🚀 Publishing report comment to Pull Request...');
  const commentUrl = await postOrUpdateComment(target, commentBody);

  console.log(`\n🎉 Success! Impact Radar comment is live on PR #${target.prNumber}:`);
  console.log(`👉 ${commentUrl}\n`);
}

run().catch((err) => {
  console.error('\n❌ [Ripple PR Bot] Error:', err.message || err);
  process.exit(1);
});
