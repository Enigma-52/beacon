#!/usr/bin/env node
/**
 * Reads coverage/coverage-summary.json from backend and frontend,
 * averages the line coverage %, and updates the badge in README.md.
 */

const fs = require('fs');
const path = require('path');

function readPct(summaryPath) {
  if (!fs.existsSync(summaryPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    return data?.total?.lines?.pct ?? null;
  } catch {
    return null;
  }
}

const backendPct = readPct(path.join(__dirname, '../backend/coverage/coverage-summary.json'));
const frontendPct = readPct(path.join(__dirname, '../frontend/coverage/coverage-summary.json'));

const values = [backendPct, frontendPct].filter((v) => v !== null);

if (values.length === 0) {
  console.log('No coverage data found, skipping badge update.');
  process.exit(0);
}

const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
const color = avg >= 80 ? 'brightgreen' : avg >= 60 ? 'yellow' : avg >= 40 ? 'orange' : 'red';
const badgeUrl = `https://img.shields.io/badge/coverage-${avg}%25-${color}?style=flat-square`;

const readmePath = path.join(__dirname, '../README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

const updated = readme.replace(
  /https:\/\/img\.shields\.io\/badge\/coverage-[^)"\s]+/g,
  badgeUrl
);

if (updated === readme) {
  console.log('No coverage badge found in README.md to update.');
} else {
  fs.writeFileSync(readmePath, updated);
  console.log(`Coverage badge updated: ${avg}% (backend: ${backendPct ?? 'n/a'}%, frontend: ${frontendPct ?? 'n/a'}%)`);
}
