#!/usr/bin/env node
// Hook PostToolUse (Edit|Write|MultiEdit).
// Si el archivo editado es .ts/.tsx y existe node_modules/.bin/eslint, ejecuta `eslint --fix` sobre él.
// Nunca falla: siempre sale con 0 e informa por stdout. Sin dependencias; multiplataforma.

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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
let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path;
if (typeof filePath !== 'string' || !/\.(ts|tsx)$/i.test(filePath)) process.exit(0);

const cwd = input?.cwd || process.cwd();
const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
if (!existsSync(abs)) process.exit(0);

// El spec pide comprobar node_modules/.bin/eslint; para ejecutar usamos el entry JS de eslint
// (evita el shim .cmd de Windows). Si no está, caemos al binario con shell.
const binDir = path.join(cwd, 'node_modules', '.bin');
const binExists =
  existsSync(path.join(binDir, 'eslint')) || existsSync(path.join(binDir, 'eslint.cmd'));
if (!binExists) process.exit(0);

const eslintJs = path.join(cwd, 'node_modules', 'eslint', 'bin', 'eslint.js');
const run = existsSync(eslintJs)
  ? spawnSync(process.execPath, [eslintJs, '--fix', abs], { cwd, encoding: 'utf8' })
  : spawnSync(path.join(binDir, 'eslint'), ['--fix', abs], { cwd, encoding: 'utf8', shell: true });

const rel = path.relative(cwd, abs).split(path.sep).join('/');
if (run.error) {
  process.stdout.write(`[lint-on-edit] no se pudo ejecutar eslint sobre ${rel}: ${run.error.message}\n`);
} else if (run.status === 0) {
  process.stdout.write(`[lint-on-edit] eslint --fix OK: ${rel}\n`);
} else {
  const out = `${run.stdout || ''}${run.stderr || ''}`.trim();
  process.stdout.write(`[lint-on-edit] eslint reportó problemas en ${rel} (no bloquea):\n${out}\n`);
}
process.exit(0);
