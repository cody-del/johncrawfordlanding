import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {verifyHuman, SITEVERIFY_URL, TOKEN_FIELD} from '../netlify/lib/turnstile.mjs';
import {createLeadHandler} from '../netlify/lib/lead-http.mjs';
import {config} from '../netlify/functions/lead.mjs';

const env = {TURNSTILE_SECRET_KEY: 'test-secret-not-real'};
// Answers siteverify with `answer` and records what was asked.
function cloudflare(answer) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url, body: new URLSearchParams(init.body)});
    if (answer instanceof Error) throw answer;
    return Response.json(answer);
  };
  return {calls, fetcher};
}

test('without a secret the check is off', async () => {
  const {calls, fetcher} = cloudflare({success: false});
  assert.equal(await verifyHuman(undefined, '1.2.3.4', {fetcher, env: {}}), true);
  assert.equal(calls.length, 0);
});

test('a token Cloudflare accepts passes, sent with the secret and the visitor IP', async () => {
  const {calls, fetcher} = cloudflare({success: true});
  assert.equal(await verifyHuman('token-1', '1.2.3.4', {fetcher, env}), true);
  assert.equal(calls[0].url, SITEVERIFY_URL);
  assert.deepEqual(Object.fromEntries(calls[0].body), {secret: 'test-secret-not-real', response: 'token-1', remoteip: '1.2.3.4'});
});

test('missing, oversized or refused tokens fail', async () => {
  const {calls, fetcher} = cloudflare({success: false, 'error-codes': ['invalid-input-response']});
  for (const token of [undefined, '', 42, 'x'.repeat(2049)]) assert.equal(await verifyHuman(token, 'ip', {fetcher, env}), false);
  assert.equal(calls.length, 0);
  assert.equal(await verifyHuman('forged', 'ip', {fetcher, env}), false);
});

test('Cloudflare being unreachable lets the lead through', async () => {
  const {fetcher} = cloudflare(new Error('down'));
  assert.equal(await verifyHuman('token-1', 'ip', {fetcher, env}), true);
});

test('the handler refuses a failed check and never passes the token on', async () => {
  const seen = [];
  const submit = async data => { seen.push(data); return {status: 200, body: {success: true}}; };
  const post = isHuman => createLeadHandler(submit, () => false, isHuman)(new Request('https://www.example.com/api/lead', {
    method: 'POST', headers: {origin: 'https://www.example.com', 'content-type': 'application/json'},
    body: JSON.stringify({form: 'contact', [TOKEN_FIELD]: 'token-1'}),
  }), {ip: '1.2.3.4'});
  const refused = await post(async () => false);
  assert.equal(refused.status, 403);
  assert.match((await refused.json()).error, /call \(818\) 884-5464/);
  assert.equal(seen.length, 0);
  const passed = await post(async (token, ip) => token === 'token-1' && ip === '1.2.3.4');
  assert.equal(passed.status, 200);
  assert.deepEqual(seen, [{form: 'contact'}]);
});

test('Netlify rate-limits /api/lead per visitor', () => {
  assert.deepEqual(config, {path: '/api/lead', rateLimit: {windowLimit: 10, windowSize: 180, aggregateBy: ['ip', 'domain']}});
});

test('every lead form gets the widget, with the test key away from the live hosts', () => {
  const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /const human = humanCheck\(form\);/);
  assert.match(app, /payload\['cf-turnstile-response'\] = token;/);
  assert.match(app, /TURNSTILE_LIVE_HOSTS\.includes\(location\.hostname\) \? '[^']*' : '1x00000000000000000000AA'/);
});

// Runs dist/app.js's real humanCheck() against a fake Cloudflare widget and a clock the test controls.
async function runHumanCheck({expired = false, ageMs = 0, failScript = false} = {}) {
  const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('const TURNSTILE_LIVE_HOSTS');
  const end = app.indexOf('\n}\n', app.indexOf('function humanCheck')) + 3;
  const clock = {now: 1_000_000};
  const state = {resets: 0, options: null, token: 'token-1', expired};
  const turnstile = {
    render: (container, options) => { state.options = options; options.callback(state.token); return 'w1'; },
    getResponse: () => state.token,
    isExpired: () => state.expired,
    reset: () => { state.resets++; state.expired = false; state.token = `token-${state.resets + 1}`; state.options.callback(state.token); },
  };
  const window = {};
  const sandbox = {
    window, turnstile, location: {hostname: 'www.johncrawfordcompany.com'},
    Date: {now: () => clock.now},
    setTimeout: callback => setImmediate(callback),
    document: {
      createElement: () => ({}),
      head: {append: script => queueMicrotask(() => (failScript ? script.onerror() : window.onTurnstileLoad()))},
    },
  };
  const human = vm.runInNewContext(`${app.slice(start, end)}\nhumanCheck`, sandbox)({
    dataset: {leadForm: 'contact'}, querySelector: () => ({before() {}}),
  });
  await new Promise(resolve => setImmediate(resolve));
  clock.now += ageMs;
  return {token: await human.token(), state, human};
}

test('a fresh token is sent as is', async () => {
  const {token, state} = await runHumanCheck({ageMs: 200_000});
  assert.equal(token, 'token-1');
  assert.equal(state.resets, 0);
  assert.equal(state.options['refresh-expired'], 'auto');
});

test('a token older than 270 s is swapped for a fresh one before sending', async () => {
  const {token, state} = await runHumanCheck({ageMs: 271_000});
  assert.equal(token, 'token-2');
  assert.equal(state.resets, 1);
});

test('a token Cloudflare marks expired is swapped, whatever its age', async () => {
  const {token, state} = await runHumanCheck({expired: true, ageMs: 1_000});
  assert.equal(token, 'token-2');
  assert.equal(state.resets, 1);
});

test('if the Turnstile script never loads the lead still goes, with an empty token', async () => {
  const {token} = await runHumanCheck({failScript: true});
  assert.equal(token, '');
});
