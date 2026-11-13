// Runs every tests/*.test.mjs plus tests/run.mjs, one child process each,
// parses the "N passed" line, prints one line per file and a grand total.
// Exits 1 if any file fails OR reports 0 tests.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => path.join(dir, f));

const legacy = path.join(dir, 'run.mjs');
if (fs.existsSync(legacy)) files.push(legacy);

let totalPassed = 0;
let totalFailed = 0;
let bad = 0;

for (const file of files) {
  const rel = path.relative(path.join(dir, '..'), file).replace(/\\/g, '/');
  const res = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 120000 });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  const m = out.match(/(\d+)\s+passed/i);
  const f = out.match(/(\d+)\s+failed/i);
  const passed = m ? Number(m[1]) : 0;
  const failed = f ? Number(f[1]) : 0;

  const status = res.status ?? 1;
  let verdict = 'ok';
  if (status !== 0) verdict = `EXIT ${status}`;
  if (passed === 0) verdict = 'NO TESTS (stub or crash)';

  console.log(`${rel.padEnd(34)} ${String(passed).padStart(4)} passed  ${String(failed).padStart(3)} failed   ${verdict}`);

  if (verdict !== 'ok' || failed > 0) {
    bad += 1;
    if (passed === 0) {
      const tail = out.trim().split('\n').slice(-6).join('\n  ');
      if (tail) console.log(`  ↳ ${tail}`);
    }
  }
  totalPassed += passed;
  totalFailed += failed;
}

console.log('-'.repeat(64));
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed across ${files.length} files`);
if (bad) {
  console.log(`${bad} file(s) failed or reported 0 tests.`);
  if (files.some((f) => path.basename(f) === 'run.mjs')) {
    console.log('NOTE: tests/run.mjs is a placeholder. The original 41-test suite was not recoverable (no git history in this folder).');
  }
}
process.exit(bad || totalFailed ? 1 : 0);
