import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const serverFile = fileURLToPath(new URL('../scripts/review-server.mjs', import.meta.url));
const fakeCli = new URL('./fixtures/fake-codex.cjs', import.meta.url);
const session = { sessionId: 'completion-test', name: 'Completion test', tool: 'codex' };

async function until(read, description) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await delay(20);
  }
  assert.fail(`Timed out: ${description}`);
}

async function fixture(t, tool = 'codex') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-completion-test-'));
  const root = path.join(temp, 'custom feedback');
  const bin = path.join(temp, 'fake bin');
  const cli = path.join(bin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  const outcome = path.join(path.dirname(cli), 'outcome.json');
  const writeOutcome = (code) => fs.writeFileSync(outcome, JSON.stringify({ code }));
  const lines = (name) => {
    const file = path.join(path.dirname(cli), name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
  };
  const attempts = () => lines('attempts.jsonl').map((line) => JSON.parse(line));
  let child, closed;
  t.after(async () => {
    writeOutcome(99);
    await until(() => lines('finished.jsonl').length === attempts().length, 'synthetic CLI exit');
    if (child) { child.kill(); await closed; }
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('review-completion-test-'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'sessions'), { recursive: true });
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.copyFileSync(fakeCli, cli);
  fs.writeFileSync(path.join(bin, 'codex.cmd'), '@echo off\r\nexit /b 98\r\n');
  if (process.platform !== 'win32') {
    fs.chmodSync(cli, 0o755);
    fs.symlinkSync(cli, path.join(bin, 'codex'));
    fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  }
  writeOutcome(null);
  fs.writeFileSync(path.join(root, 'review.html'), '<!doctype html><title>Isolated completion test</title>');
  const transcript = path.join(temp, 'empty-transcript.jsonl');
  fs.writeFileSync(transcript, '');
  fs.writeFileSync(path.join(root, 'sessions', `${session.sessionId}.json`), JSON.stringify({ ...session, tool, path: transcript }));
  const seen = { [session.sessionId]: '2000-01-01T00:00:00.000Z' };
  fs.writeFileSync(path.join(root, 'seen.json'), JSON.stringify(seen));
  const env = {
    PATH: bin, HOME: temp, USERPROFILE: temp, CODEX_HOME: temp,
    APPDATA: temp, LOCALAPPDATA: temp, TEMP: temp, TMP: temp,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  };
  let base;
  const start = async () => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
    base = `http://127.0.0.1:${port}`;
    // Run the original entrypoint, with no inherited CLI path, credentials, hooks or sessions.
    child = spawn(process.execPath, [serverFile, '--dir', root, '--port', String(port)], { cwd: temp, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    closed = once(child, 'close');
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    await until(() => {
      assert.equal(child.exitCode, null, output);
      return output.includes(base.replace('127.0.0.1', 'localhost'));
    }, 'original review server startup');
  };
  const api = async (url, body) => {
    const response = await fetch(base + url, {
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  };
  const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const entry = () => fs.existsSync(path.join(root, 'chat.json')) && read('chat.json').messages[0];
  const complete = async (round = '7', target = session.name) => {
    const response = await api(`/api/feedback?round=${round}`, { done: true, name: 'Synthetic review', session: target });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(read(`r${round}.json`).done, true);
  };
  await start();
  return {
    root, read, entry, api, complete, attempts, writeOutcome, seen,
    restart: async () => { child.kill(); await closed; await start(); },
  };
}

test('completion uses the durable chat queue with the full summary, instructions and custom directory', { timeout: 15000 }, async (t) => {
  const f = await fixture(t);
  const memo = 'Keep "quoted words"\n\uD55C\uAE00 \\tail\\ $env:PATH `text` & | < > %PATH% (.ui-feedback/r7.json)';
  const items = {
    accepted: { title: 'Accepted item', verdict: 'good', memo, pins: [{ image: 'shot.png', x: 20, y: 30, note: 'Pin on accepted item' }] },
    change: { title: 'Change item', verdict: 'tweak', memo: 'Change request' },
    undo: { title: 'Undo item', verdict: 'revert', memo: 'Undo request' },
    unrated: { title: 'Unrated item', memo: 'Memo without verdict' },
  };
  for (const [id, fields] of Object.entries(items)) assert.equal((await f.api('/api/feedback?round=7', { id, fields })).status, 200);
  await f.api('/api/feedback?round=7', { overall: 'Overall request and question?' });
  await f.complete();
  assert.equal(f.entry().queue?.state, 'pending');
  await until(() => f.attempts().length === 1, 'synthetic CLI start');
  const entry = f.entry();
  assert.equal(entry.from, 'user');
  assert.equal(entry.to, session.sessionId);
  assert.equal(entry.context, 'review');
  assert.equal(entry.round, 7);
  const message = f.attempts()[0];
  assert.deepEqual(message.slice(0, 4), ['queue', '--thread', session.sessionId, '--message']);
  assert.ok(message[4].endsWith(entry.text));
  for (const text of [memo, 'Pin on accepted item', 'Change request', 'Undo request', 'Memo without verdict', 'Overall request and question?', 'Synthetic review']) assert.ok(entry.text.includes(text), text);
  for (const name of ['r7.json', 'chat.json', 'requests.md']) assert.ok(entry.text.includes(JSON.stringify(path.join(f.root, name))), name);
  assert.ok(entry.text.includes(`(${path.join(f.root, 'r7.json')})`));
  assert.match(entry.text, /ui-feedback-loop 5/);
  assert.match(entry.text, /memo/);
  assert.match(entry.text, /pins/);
  assert.match(entry.text, /overall/);
  f.writeOutcome(0);
  await until(() => f.entry().queue?.state === 'accepted', 'persisted acceptance');
  assert.equal(f.entry().queue.ok, true);
  assert.equal(fs.existsSync(path.join(f.root, 'delivered.json')), false);
  assert.deepEqual(f.read('seen.json'), f.seen);
  const watch = (await f.api('/api/watch?session=completion-test&round=7')).body;
  assert.equal(watch.active, true);
  assert.equal(watch.configured, true);
  assert.equal(watch.via, 'queue');
  assert.notEqual(watch.handling, true);
  assert.deepEqual((await f.api('/api/chat')).body.delivered, {});
  assert.equal((await f.api('/api/sessions')).body.sessions[0].status.state, 'unknown');
  await f.complete();
  await f.restart();
  await f.complete();
  assert.equal(f.entry().queue.state, 'accepted');
  assert.equal(f.attempts().length, 1);
  assert.equal(f.read('chat.json').messages.length, 1);
});

test('completion queue failure survives restart and retries the same saved message explicitly', { timeout: 15000 }, async (t) => {
  const f = await fixture(t);
  f.writeOutcome(7);
  await f.complete('failure-round', session.sessionId);
  await until(() => f.entry().queue?.state === 'failed', 'persisted queue failure');
  const failed = f.entry();
  assert.equal(failed.queue.code, 7);
  assert.equal(failed.queue.ok, false);
  await f.restart();
  await f.complete('failure-round', session.sessionId);
  assert.equal(f.entry().queue.state, 'failed');
  assert.equal(f.attempts().length, 1);
  f.writeOutcome(0);
  const retry = await f.api('/api/chat-retry', { id: failed.id });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, failed.id);
  assert.equal(retry.body.queue.state, 'accepted');
  assert.equal(f.read('chat.json').messages.length, 1);
  assert.deepEqual(f.attempts()[1], f.attempts()[0]);
  assert.equal(fs.existsSync(path.join(f.root, 'delivered.json')), false);
  assert.deepEqual(f.read('seen.json'), f.seen);
});

test('Claude completion stays synchronous and unknown sessions do not enqueue', { timeout: 15000 }, async (t) => {
  const f = await fixture(t, 'claude');
  await f.complete();
  assert.equal(f.entry().queue, undefined);
  assert.equal(f.entry().to, session.sessionId);
  assert.ok(f.entry().text.includes(path.join(f.root, 'r7.json')));
  assert.deepEqual(f.read('seen.json'), f.seen);
  await f.complete('unknown', 'unregistered-session');
  assert.equal(f.read('chat.json').messages.length, 1);
  assert.equal(f.attempts().length, 0);
});
