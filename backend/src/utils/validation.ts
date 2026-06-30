const GITHUB_URL_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/;

export function isValidGitHubUrl(url: string): boolean {
  return GITHUB_URL_RE.test(url);
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
