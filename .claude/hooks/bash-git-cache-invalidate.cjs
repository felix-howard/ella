#!/usr/bin/env node
'use strict';

/**
 * Invalidate git-info-cache after Bash commands that change git state.
 *
 * Without this, the statusline shows a stale branch name for up to 30s
 * after `git checkout` because the cache TTL has not expired and the
 * Edit/Write PostToolUse invalidation never fires for Bash-driven changes.
 */

const { invalidateCache } = require('./lib/git-info-cache.cjs');

// Commands that mutate git refs/index — anything that could change branch,
// HEAD, ahead/behind counts, or staged/unstaged sets.
const MUTATING_GIT_RE = /\bgit\s+(?:checkout|switch|commit|pull|fetch|merge|rebase|reset|restore|stash|cherry-pick|branch|add|rm|mv|tag|clone|init)\b/;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

(async () => {
  try {
    const raw = await readStdin();
    if (!raw) return;
    const payload = JSON.parse(raw);
    const cmd = payload?.tool_input?.command || '';
    if (!MUTATING_GIT_RE.test(cmd)) return;
    invalidateCache(payload.cwd || process.cwd());
  } catch {
    // Silent — never break the tool pipeline
  }
})();
