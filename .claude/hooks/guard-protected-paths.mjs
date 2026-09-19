#!/usr/bin/env node
// Hook PreToolUse (Edit|Write|MultiEdit).
// Bloquea ediciones en rutas protegidas salvo que la rama actual sea `adr/*` o `contracts/*`.
// Lee el JSON del hook por stdin. Exit 2 = bloquear (stderr se muestra a Claude); exit 0 = permitir.
// Sin dependencias; funciona en Windows, macOS y Linux.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const PROTECTED = [
  { test: (p) => p.startsWith('packages/contracts/'), label: 'packages/contracts/**' },
  { test: (p) => p.startsWith('src/contracts/'), label: 'src/contracts/**' },
  { test: (p) => p === 'models/manifest.json', label: 'models/manifest.json' },
];
const ALLOWED_BRANCH_PREFIXES = ['adr/', 'contracts/'];

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

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function toRepoRelative(filePath, cwd) {
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], cwd);
  } catch {
    root = cwd;
  }
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  return rel.startsWith('..') ? abs.split(path.sep).join('/') : rel;
}

const raw = await readStdin();
let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0); // JSON ilegible: no bloquear trabajo ajeno a este hook
}

const filePath = input?.tool_input?.file_path;
if (typeof filePath !== 'string' || filePath.length === 0) process.exit(0);

const cwd = input?.cwd || process.cwd();
const rel = toRepoRelative(filePath, cwd);
const hit = PROTECTED.find((r) => r.test(rel));
if (!hit) process.exit(0);

let branch = '';
try {
  branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
} catch {
  process.exit(0); // sin git disponible no podemos decidir; no bloquear
}

if (ALLOWED_BRANCH_PREFIXES.some((p) => branch.startsWith(p))) process.exit(0);

process.stderr.write(
  [
    `Edición bloqueada: "${rel}" es una ruta protegida (${hit.label}).`,
    `Rama actual: "${branch}". Los contratos y el manifest de modelos solo se cambian en ramas`,
    `"adr/*" o "contracts/*", con bump de semver, campo schemaVersion y una DEC enlazada en el PR.`,
    `Pasos: (1) crea la DEC con /adr, (2) git switch -c adr/<slug>, (3) vuelve a intentar la edición.`,
    `Si es una excepción puntual, desactiva el hook localmente en .claude/settings.local.json (ver .claude/README.md).`,
  ].join('\n') + '\n',
);
process.exit(2);
