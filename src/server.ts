import express, { Request, Response } from 'express';
import cors from 'cors';
import { analyzeRepository } from './domain/analysis/analyzer.js';
import { AnalysisResult, RepositoryFileInput, ChangedFileInput } from './domain/analysis/types.js';
import { fetchGitHubPullRequest, parseGitHubPrUrl } from './domain/github/github-fetcher.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory store for completed analyses
interface StoredAnalysis {
  id: string;
  pullRequestUrl?: string;
  repository?: string;
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    baseSha?: string;
    headSha?: string;
  };
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: AnalysisResult;
  createdAt: string;
  executionTimeMs: number;
}

const analyses = new Map<string, StoredAnalysis>();

// Preset demo repositories for instant evaluation
const PRESET_SAMPLES: Record<
  string,
  {
    name: string;
    prUrl: string;
    title: string;
    repositoryFiles: RepositoryFileInput[];
    changedFiles: ChangedFileInput[];
  }
> = {
  'auth-core': {
    name: 'Authentication Core Refactor (Person 2 Scenario)',
    prUrl: 'https://github.com/ripple-impact/demo/pull/1',
    title: 'refactor(auth): harden session authentication validation',
    repositoryFiles: [
      {
        path: 'src/auth.js',
        content: `
          export function authenticate(user) {
            if (!user) return false;
            return Boolean(user.token && user.isAuthenticated);
          }
          export function generateToken(user) {
            return "jwt_" + user.id;
          }
        `,
      },
      {
        path: 'src/users.js',
        content: `
          import { authenticate } from "./auth.js";
          export function getUser(user) {
            if (!authenticate(user)) throw new Error("Unauthorized");
            return { id: user.id, name: user.name };
          }
        `,
      },
      {
        path: 'src/orders.js',
        content: `
          import { authenticate } from "./auth.js";
          export function createOrder(user, item) {
            if (!authenticate(user)) throw new Error("Unauthorized");
            return { orderId: "ord_101", item, status: "pending" };
          }
        `,
      },
      {
        path: 'src/profile.js',
        content: `
          import { getUser } from "./users.js";
          export function getProfile(user) {
            return { profile: getUser(user), preferences: {} };
          }
        `,
      },
      {
        path: 'src/checkout.js',
        content: `
          import { createOrder } from "./orders.js";
          export function checkout(user, cart) {
            return createOrder(user, cart);
          }
        `,
      },
      {
        path: 'src/unrelated.js',
        content: `
          export const APP_VERSION = "1.0.0";
        `,
      },
    ],
    changedFiles: [
      {
        path: 'src/auth.js',
        additions: 145,
        deletions: 28,
        status: 'modified',
      },
    ],
  },
  'user-service': {
    name: 'User Service & Controller API Refactor',
    prUrl: 'https://github.com/ripple-impact/demo/pull/2',
    title: 'feat(users): add role-based permission checks to user routes',
    repositoryFiles: [
      {
        path: 'src/config/database.ts',
        content: `export const dbConfig = { host: "localhost", port: 5432 };`,
      },
      {
        path: 'src/models/user.model.ts',
        content: `
          import { dbConfig } from "../config/database.js";
          export interface User { id: string; role: string; }
        `,
      },
      {
        path: 'src/services/user.service.ts',
        content: `
          import { User } from "../models/user.model.js";
          export async function fetchUserById(id: string): Promise<User> {
            return { id, role: "member" };
          }
        `,
      },
      {
        path: 'src/controllers/user.controller.ts',
        content: `
          import { fetchUserById } from "../services/user.service.js";
          export const getUserHandler = async (req: any) => fetchUserById(req.id);
        `,
      },
      {
        path: 'src/routes/user.routes.ts',
        content: `
          import { getUserHandler } from "../controllers/user.controller.js";
          export const registerUserRoutes = (app: any) => app.get("/user", getUserHandler);
        `,
      },
    ],
    changedFiles: [
      {
        path: 'src/models/user.model.ts',
        additions: 85,
        deletions: 12,
        status: 'modified',
      },
    ],
  },
  'payment-gateway': {
    name: 'Payment Processing Gateway Migration',
    prUrl: 'https://github.com/ripple-impact/demo/pull/3',
    title: 'feat(billing): integrate Stripe 2026 payment intent endpoints',
    repositoryFiles: [
      {
        path: 'src/services/payment/stripe.ts',
        content: `export function processPayment(amount: number) { return { chargeId: "ch_999", amount }; }`,
      },
      {
        path: 'src/services/payment/index.ts',
        content: `
          export * from "./stripe.js";
        `,
      },
      {
        path: 'src/services/billing.service.ts',
        content: `
          import { processPayment } from "./payment/index.js";
          export function chargeSubscription(amount: number) { return processPayment(amount); }
        `,
      },
      {
        path: 'src/controllers/billing.controller.ts',
        content: `
          import { chargeSubscription } from "../services/billing.service.js";
          export const handleBilling = (amt: number) => chargeSubscription(amt);
        `,
      },
      {
        path: 'src/app.ts',
        content: `
          import { handleBilling } from "./controllers/billing.controller.js";
          export function main() { handleBilling(50); }
        `,
      },
    ],
    changedFiles: [
      {
        path: 'src/services/payment/stripe.ts',
        additions: 210,
        deletions: 45,
        status: 'modified',
      },
    ],
  },
};

/**
 * Health check endpoint
 */
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ripple-core-engine',
    timestamp: new Date().toISOString(),
  });
});

/**
 * List available sample scenarios
 */
app.get('/api/v1/samples', (_req: Request, res: Response) => {
  const list = Object.entries(PRESET_SAMPLES).map(([key, sample]) => ({
    key,
    name: sample.name,
    prUrl: sample.prUrl,
    title: sample.title,
    changedFilesCount: sample.changedFiles.length,
    totalFilesCount: sample.repositoryFiles.length,
  }));
  res.json({ success: true, data: list });
});

/**
 * Direct synchronous analysis endpoint supporting both preset scenarios
 * and LIVE real GitHub pull requests via GitHub API
 */
app.post('/api/v1/analyze', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { pullRequestUrl, sampleKey, repositoryFiles, changedFiles } = req.body;

  try {
    let repoFiles: RepositoryFileInput[] = [];
    let prChanges: ChangedFileInput[] = [];
    let prTitle = 'PR Impact Analysis';
    let prMeta = { number: 1, title: prTitle, url: pullRequestUrl || 'https://github.com/owner/repo/pull/1' };

    // 1. Preset sample requested
    if (sampleKey && PRESET_SAMPLES[sampleKey]) {
      const sample = PRESET_SAMPLES[sampleKey];
      repoFiles = sample.repositoryFiles;
      prChanges = sample.changedFiles;
      prTitle = sample.title;
      prMeta = { number: 1, title: prTitle, url: sample.prUrl };
    }
    // 2. Real GitHub Pull Request URL or string input
    else if (pullRequestUrl && typeof pullRequestUrl === 'string') {
      const trimmedUrl = pullRequestUrl.trim();

      // Check if URL matches a preset
      const matchedPreset = Object.values(PRESET_SAMPLES).find(
        (s) => s.prUrl.toLowerCase() === trimmedUrl.toLowerCase()
      );

      if (matchedPreset) {
        repoFiles = matchedPreset.repositoryFiles;
        prChanges = matchedPreset.changedFiles;
        prTitle = matchedPreset.title;
        prMeta = { number: 1, title: prTitle, url: matchedPreset.prUrl };
      } else {
        const parsed = parseGitHubPrUrl(trimmedUrl);
        if (!parsed) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PR_URL',
              message: 'Invalid GitHub pull request URL. Please provide a valid URL like: https://github.com/owner/repo/pull/123',
            },
          });
          return;
        }

        // Fetch real GitHub pull request and repository source files
        const fetched = await fetchGitHubPullRequest(parsed);
        repoFiles = fetched.repositoryFiles;
        prChanges = fetched.changedFiles;
        prTitle = fetched.pullRequest.title;
        prMeta = {
          number: fetched.pullRequest.number,
          title: prTitle,
          url: fetched.pullRequest.url,
        };
      }
    }
    // 3. Raw payload with repositoryFiles and changedFiles
    else if (Array.isArray(repositoryFiles) && Array.isArray(changedFiles)) {
      repoFiles = repositoryFiles;
      prChanges = changedFiles;
    }
    // 4. Default fallback
    else {
      const fallback = PRESET_SAMPLES['auth-core']!;
      repoFiles = fallback.repositoryFiles;
      prChanges = fallback.changedFiles;
      prTitle = fallback.title;
    }

    // Run core static AST analysis engine
    const result = await analyzeRepository({
      repositoryFiles: repoFiles,
      changedFiles: prChanges,
    });

    const executionTimeMs = Date.now() - startTime;
    const analysisId = 'analysis_' + Math.random().toString(36).substring(2, 9);

    const stored: StoredAnalysis = {
      id: analysisId,
      pullRequestUrl: prMeta.url,
      repository: pullRequestUrl || 'demo/repo',
      pullRequest: prMeta,
      status: 'completed',
      result,
      createdAt: new Date().toISOString(),
      executionTimeMs,
    };

    analyses.set(analysisId, stored);

    res.json({
      success: true,
      data: {
        analysisId,
        pullRequest: prMeta,
        executionTimeMs,
        ...result,
      },
    });
  } catch (err: any) {
    console.error('Analysis error:', err);
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: err.message || 'An unexpected analysis error occurred.',
      },
    });
  }
});

/**
 * Standard REST: POST /api/v1/analyses (Enqueues analysis)
 */
app.post('/api/v1/analyses', async (req: Request, res: Response) => {
  const { pullRequestUrl } = req.body;
  if (!pullRequestUrl) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PULL_REQUEST_URL',
        message: 'Provide a valid GitHub pull request URL.',
      },
    });
    return;
  }

  const analysisId = 'analysis_' + Math.random().toString(36).substring(2, 9);
  res.status(202).json({
    success: true,
    data: {
      analysisId,
      status: 'queued',
    },
  });
});

/**
 * Fetch analysis status and summary
 */
app.get('/api/v1/analyses/:analysisId', (req: Request, res: Response) => {
  const item = analyses.get(req.params.analysisId as string);
  if (!item || !item.result) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Analysis not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      analysisId: item.id,
      status: item.status,
      repository: item.repository,
      pullRequest: item.pullRequest,
      summary: item.result.summary,
      executionTimeMs: item.executionTimeMs,
    },
  });
});

/**
 * Fetch graph data
 */
app.get('/api/v1/analyses/:analysisId/graph', (req: Request, res: Response) => {
  const item = analyses.get(req.params.analysisId as string);
  if (!item || !item.result) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Analysis not found' },
    });
    return;
  }

  const nodes = item.result.files.map((f) => ({
    id: f.path,
    filePath: f.path,
    status: f.status,
    riskScore: f.riskScore,
    impactDepth: f.impactDepth,
  }));

  res.json({
    success: true,
    data: {
      nodes,
      edges: item.result.dependencies,
    },
  });
});

/**
 * Fetch affected files
 */
app.get('/api/v1/analyses/:analysisId/affected-files', (req: Request, res: Response) => {
  const item = analyses.get(req.params.analysisId as string);
  if (!item || !item.result) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Analysis not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: item.result.files.filter((f) => f.type === 'affected'),
  });
});

app.listen(PORT, () => {
  console.log(`Ripple Core Analysis API running on http://localhost:${PORT}`);
});
