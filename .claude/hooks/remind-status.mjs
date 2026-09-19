#!/usr/bin/env node
// Hook Stop.
// Si `git status --porcelain` muestra cambios en src/, packages/, apps/, ml/ o supabase/
// y ninguno en docs/STATUS.md, imprime un recordatorio. Siempre exit 0 (no bloquea).
// Sin dependencias; multiplataforma.

import { execFileSync } from 'node:child_process';

const WATCHED = ['src/', 'packages/', 'apps/', 'ml/', 'supabase/'];
const STATUS_DOC = 'docs/STATUS.md';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    if (process.stdin.isTTY) resolve('');
  });
}

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  /* sin JSON: seguimos con cwd del proceso */
}
const cwd = input?.cwd || process.cwd();

let porcelain = '';
try {
  porcelain = execFileSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch {
  process.exit(0);
}

// Formato porcelain v1: "XY ruta" o "XY origen -> destino" (renombrados).
const paths = porcelain
  .split(/\r?\n/)
  .filter((l) => l.length > 3)
  .map((l) => l.slice(3).trim())
  .flatMap((p) => (p.includes(' -> ') ? p.split(' -> ') : [p]))
  .map((p) => p.replace(/^"|"$/g, '').replace(/\\/g, '/'));

const touchedCode = paths.filter((p) => WATCHED.some((w) => p.startsWith(w)));
const touchedStatus = paths.some((p) => p === STATUS_DOC);

if (touchedCode.length > 0 && !touchedStatus) {
  const sample = touchedCode.slice(0, 5).join(', ') + (touchedCode.length > 5 ? ', …' : '');
  const msg =
    `Recordatorio: hay cambios sin commit en código (${sample}) y docs/STATUS.md no cambió. ` +
    `Si este trabajo cierra un hito o un PR de la migración, actualiza docs/STATUS.md ` +
    `(o pide a docs-keeper que lo haga) antes de abrir el PR.`;
  // systemMessage se muestra al usuario sin bloquear la detención.
  process.stdout.write(JSON.stringify({ systemMessage: msg }) + '\n');
}
process.exit(0);
