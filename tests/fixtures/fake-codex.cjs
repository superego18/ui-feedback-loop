#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const args = process.argv.slice(2);
if (args[0] !== 'queue' || args[1] !== '--thread' || args[2] !== 'completion-test' || args[3] !== '--message' || args.length !== 5) process.exit(98);
fs.appendFileSync(path.join(dir, 'attempts.jsonl'), JSON.stringify(args) + '\n');
const started = Date.now();
const timer = setInterval(() => {
  const { code } = JSON.parse(fs.readFileSync(path.join(dir, 'outcome.json'), 'utf8'));
  if (Number.isInteger(code) || Date.now() - started > 4000) {
    clearInterval(timer);
    fs.appendFileSync(path.join(dir, 'finished.jsonl'), 'done\n');
    process.exitCode = Number.isInteger(code) ? code : 99;
  }
}, 10);
