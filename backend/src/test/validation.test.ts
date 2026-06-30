import { describe, it, expect } from 'vitest';
import { isValidGitHubUrl, parseGitHubUrl } from '../utils/validation';

describe('isValidGitHubUrl', () => {
  it('accepts valid github urls', () => {
    expect(isValidGitHubUrl('https://github.com/facebook/react')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/org/repo.js')).toBe(true);
    expect(isValidGitHubUrl('http://github.com/user/repo')).toBe(true);
    expect(isValidGitHubUrl('https://github.com/vercel/next.js')).toBe(true);
  });

  it('rejects invalid urls', () => {
    expect(isValidGitHubUrl('https://gitlab.com/foo/bar')).toBe(false);
    expect(isValidGitHubUrl('not-a-url')).toBe(false);
    expect(isValidGitHubUrl('')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/')).toBe(false);
    expect(isValidGitHubUrl('https://github.com/onlyowner')).toBe(false);
  });
});

describe('parseGitHubUrl', () => {
  it('parses owner and repo', () => {
    expect(parseGitHubUrl('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('returns null for invalid url', () => {
    expect(parseGitHubUrl('https://gitlab.com/foo/bar')).toBeNull();
    expect(parseGitHubUrl('')).toBeNull();
  });
});
