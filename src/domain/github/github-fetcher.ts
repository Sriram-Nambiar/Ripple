import { execSync } from 'node:child_process';
import { ChangedFileInput, RepositoryFileInput } from '../analysis/types.js';
import { isExcludedPath, isSupportedFile, normalizePath } from '../analysis/parser/file-types.js';

let cachedToken: string | null = null;
let tokenLookupAttempted = false;

/**
 * Retrieves GitHub token from environment variable or local gh CLI.
 */
export function getGitHubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  if (cachedToken) return cachedToken;
  if (tokenLookupAttempted) return null;

  tokenLookupAttempted = true;
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (token && token.length > 10) {
      cachedToken = token;
      return token;
    }
  } catch {
    // gh CLI not available or not logged in
  }
  return null;
}

export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

/**
 * Robust parser for various GitHub PR URL formats:
 * - https://github.com/owner/repo/pull/123
 * - github.com/owner/repo/pull/123
 * - owner/repo#123
 * - owner/repo/pull/123
 */
export function parseGitHubPrUrl(url: string): ParsedPrUrl | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Standard web URL
  const webMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (webMatch && webMatch[1] && webMatch[2] && webMatch[3]) {
    return {
      owner: webMatch[1],
      repo: webMatch[2],
      number: parseInt(webMatch[3], 10),
      url: `https://github.com/${webMatch[1]}/${webMatch[2]}/pull/${webMatch[3]}`,
    };
  }

  // Short syntax: owner/repo#123
  const hashMatch = trimmed.match(/^([^/\s]+)\/([^/#\s]+)#(\d+)$/);
  if (hashMatch && hashMatch[1] && hashMatch[2] && hashMatch[3]) {
    return {
      owner: hashMatch[1],
      repo: hashMatch[2],
      number: parseInt(hashMatch[3], 10),
      url: `https://github.com/${hashMatch[1]}/${hashMatch[2]}/pull/${hashMatch[3]}`,
    };
  }

  // Short path: owner/repo/pull/123
  const pathMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i);
  if (pathMatch && pathMatch[1] && pathMatch[2] && pathMatch[3]) {
    return {
      owner: pathMatch[1],
      repo: pathMatch[2],
      number: parseInt(pathMatch[3], 10),
      url: `https://github.com/${pathMatch[1]}/${pathMatch[2]}/pull/${pathMatch[3]}`,
    };
  }

  return null;
}

export interface FetchedPullRequestData {
  pullRequest: {
    number: number;
    title: string;
    url: string;
    baseSha: string;
    headSha: string;
    owner: string;
    repo: string;
    additions: number;
    deletions: number;
  };
  repositoryFiles: RepositoryFileInput[];
  changedFiles: ChangedFileInput[];
}

/**
 * Fetches real pull request data and repository snapshot from GitHub API.
 */
export async function fetchGitHubPullRequest(
  parsed: ParsedPrUrl
): Promise<FetchedPullRequestData> {
  const token = getGitHubToken();
  const headers: Record<string, string> = {
    'User-Agent': 'Ripple-PR-Radar/1.0',
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Fetch Pull Request metadata
  const prApiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
  const prRes = await fetch(prApiUrl, { headers });

  if (prRes.status === 404) {
    throw new Error(
      `Pull request #${parsed.number} was not found on ${parsed.owner}/${parsed.repo}. Make sure the repository is public and the PR number is valid.`
    );
  }

  if (prRes.status === 403 || prRes.status === 429) {
    const rateLimitReset = prRes.headers.get('x-ratelimit-reset');
    throw new Error(
      `GitHub API rate limit exceeded. Authenticate using GitHub CLI or set GITHUB_TOKEN to proceed (reset at ${rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000).toLocaleTimeString() : 'soon'}).`
    );
  }

  if (!prRes.ok) {
    throw new Error(`GitHub API error (${prRes.status}): ${prRes.statusText}`);
  }

  const pr = (await prRes.json()) as any;
  const headSha = pr.head.sha;
  const baseSha = pr.base.sha;
  const headRepoFullName = pr.head.repo?.full_name || `${parsed.owner}/${parsed.repo}`;

  // 2. Fetch list of changed files
  const filesApiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/files?per_page=100`;
  const filesRes = await fetch(filesApiUrl, { headers });

  let rawFiles: any[] = [];
  if (filesRes.ok) {
    rawFiles = (await filesRes.json()) as any[];
  }

  const changedFiles: ChangedFileInput[] = rawFiles.map((f) => ({
    path: normalizePath(f.filename),
    status: f.status || 'modified',
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    previousPath: f.previous_filename ? normalizePath(f.previous_filename) : undefined,
  }));

  // 3. Fetch Git tree at headSha to discover all repository files
  const treeApiUrl = `https://api.github.com/repos/${headRepoFullName}/git/trees/${headSha}?recursive=1`;
  let treeRes = await fetch(treeApiUrl, { headers });

  // If head repo tree fails (e.g. fork access), fallback to base repo with headSha
  if (!treeRes.ok && headRepoFullName !== `${parsed.owner}/${parsed.repo}`) {
    const fallbackTreeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${headSha}?recursive=1`;
    treeRes = await fetch(fallbackTreeUrl, { headers });
  }

  let allRepoPaths: string[] = [];
  if (treeRes.ok) {
    const treeData = (await treeRes.json()) as any;
    if (Array.isArray(treeData.tree)) {
      allRepoPaths = treeData.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => normalizePath(item.path))
        .filter((p: string) => isSupportedFile(p) && !isExcludedPath(p));
    }
  }

  // Ensure changed files are included
  for (const cf of changedFiles) {
    const pathStr = typeof cf === 'string' ? cf : cf.path;
    if (isSupportedFile(pathStr) && !isExcludedPath(pathStr) && !allRepoPaths.includes(pathStr)) {
      allRepoPaths.push(pathStr);
    }
  }

  // 4. Select candidate files to fetch content for
  // If repository is huge, prioritize:
  // - All changed files
  // - Files in the same directories as changed files
  // - Files that match import references
  const changedPathsSet = new Set(
    changedFiles.map((c) => (typeof c === 'string' ? c : c.path))
  );

  const changedDirs = new Set<string>();
  for (const cp of changedPathsSet) {
    const parts = cp.split('/');
    parts.pop();
    changedDirs.add(parts.join('/'));
  }

  // Sort files: changed first, same-directory second, others third
  const sortedPaths = [...allRepoPaths].sort((a, b) => {
    const aIsChanged = changedPathsSet.has(a);
    const bIsChanged = changedPathsSet.has(b);
    if (aIsChanged && !bIsChanged) return -1;
    if (!aIsChanged && bIsChanged) return 1;

    const aDir = a.split('/').slice(0, -1).join('/');
    const bDir = b.split('/').slice(0, -1).join('/');
    const aInDir = changedDirs.has(aDir);
    const bInDir = changedDirs.has(bDir);
    if (aInDir && !bInDir) return -1;
    if (!aInDir && bInDir) return 1;

    return 0;
  });

  // Limit to at most 60 files to guarantee fast response time (<2 seconds)
  const pathsToFetch = sortedPaths.slice(0, 60);

  // 5. Concurrently fetch raw file contents
  const repositoryFiles: RepositoryFileInput[] = [];

  const fetchPromises = pathsToFetch.map(async (filePath) => {
    const rawUrl = `https://raw.githubusercontent.com/${headRepoFullName}/${headSha}/${filePath}`;
    try {
      const rawRes = await fetch(rawUrl, {
        headers: token ? { Authorization: `token ${token}` } : undefined,
      });

      if (rawRes.ok) {
        const content = await rawRes.text();
        return { path: filePath, content };
      }
    } catch {
      // Ignore individual file fetch failures
    }
    return null;
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      repositoryFiles.push(res.value);
    }
  }

  return {
    pullRequest: {
      number: parsed.number,
      title: pr.title || `PR #${parsed.number}`,
      url: parsed.url,
      baseSha,
      headSha,
      owner: parsed.owner,
      repo: parsed.repo,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
    },
    repositoryFiles,
    changedFiles,
  };
}
