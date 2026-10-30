import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {submitLead, GHL_API, MIN_FILL_MS} from '../netlify/lib/lead.mjs';
import {createLeadHandler, createRateLimiter} from '../netlify/lib/lead-http.mjs';

const env = {GHL_PRIVATE_TOKEN: 'pit-test', GHL_LOCATION_ID: 'loc-test'};
const lead = (extra = {}) => ({
  form: 'quote', page: '/lp/motorized-shades/', name: 'Ada  Lovelace King', phone: '(818) 555-0142',
  email: ' Ada@Example.com ', 'appointment-type': 'in-home', website: '', elapsedMs: MIN_FILL_MS + 500, ...extra,
});

// Records every GHL call and answers the upsert with a contact id.
function ghl({upsert = {status: 200, body: {contact: {id: 'c-1'}}}, note = {status: 201}} = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url, init, body: JSON.parse(init.body)});
    const answer = url.endsWith('/notes') ? note : upsert;
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {status: answer.status});
  };
  return {calls, fetcher};
}

test('a landing lead is upserted with the landing tag, its page source and the appointment tag', async () => {
  const {calls, fetcher} = ghl();
  const result = await submitLead(lead(), {fetcher, env});
  assert.deepEqual(result, {status: 200, body: {success: true, contactId: 'c-1'}});
  assert.equal(calls[0].url, `${GHL_API}/contacts/upsert`);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer pit-test');
  assert.deepEqual(calls[0].body, {
    locationId: 'loc-test', firstName: 'Ada', lastName: 'Lovelace King', phone: '+18185550142',
    email: 'ada@example.com', source: 'Google Ads Landing Page: Motorized Shades',
    tags: ['google_landing_page', 'in-home-consultation'],
  });
  assert.equal(calls[1].url, `${GHL_API}/contacts/c-1/notes`);
  assert.equal(calls[1].body.body, 'Google Ads Landing Page: Motorized Shades form\nI’d like to schedule: Free in-home consultation');
});

test('without an appointment choice there is no extra tag and no note', async () => {
  const {calls, fetcher} = ghl();
  const result = await submitLead(lead({'appointment-type': undefined, page: '/lp/custom-window-treatments/'}), {fetcher, env});
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.tags, ['google_landing_page']);
  assert.equal(calls[0].body.source, 'Google Ads Landing Page: Custom Window Treatments');
});

test('an unknown page falls back to the form source', async () => {
  const {calls, fetcher} = ghl();
  await submitLead(lead({page: '/somewhere/else/'}), {fetcher, env});
  assert.equal(calls[0].body.source, 'Google Ads Landing Page');
});

test('bots, fast fills, bad fields and unknown forms never reach GHL', async () => {
  const cases = [
    null, [], lead({form: 'contact'}), lead({form: '__proto__'}), lead({website: 'spam.example'}),
    lead({elapsedMs: 200}), lead({elapsedMs: '9000'}), lead({name: ' '}), lead({phone: '555-0142'}),
    lead({email: 'not-an-email'}), lead({'appointment-type': 'tomorrow'}), lead({'appointment-type': 3}),
    lead({name: 'x'.repeat(121)}),
  ];
  for (const data of cases) {
    const {calls, fetcher} = ghl();
    const result = await submitLead(data, {fetcher, env});
    assert.equal(result.status, 400, JSON.stringify(data));
    assert.equal(result.body.success, false);
    assert.equal(calls.length, 0);
  }
});

test('rate-limited and unconfigured requests are refused before GHL', async () => {
  const {calls, fetcher} = ghl();
  assert.equal((await submitLead(lead(), {fetcher, env, rateLimited: () => true})).status, 429);
  assert.equal((await submitLead(lead(), {fetcher, env: {}})).status, 500);
  assert.equal(calls.length, 0);
});

test('a lead counts only when GHL returns a contact id', async () => {
  for (const upsert of [{status: 403, body: {message: 'no access'}}, {status: 200, body: {}}, new Error('down')]) {
    const {calls, fetcher} = ghl({upsert});
    const result = await submitLead(lead(), {fetcher, env});
    assert.equal(result.status, 502);
    assert.equal(calls.length, 1);
  }
});

test('a failed note still counts the lead', async () => {
  for (const note of [{status: 500}, new Error('down')]) {
    const {fetcher} = ghl({note});
    assert.deepEqual(await submitLead(lead(), {fetcher, env}), {status: 200, body: {success: true, contactId: 'c-1'}});
  }
});

test('the handler takes only same-origin JSON posts', async () => {
  const handler = createLeadHandler(async data => ({status: 200, body: {success: true, got: data.form}}));
  const url = 'https://go.example.com/api/lead';
  const post = (headers, body = '{"form":"quote"}') => handler(new Request(url, {method: 'POST', headers, body}), {ip: '1.2.3.4'});
  assert.equal((await handler(new Request(url))).status, 405);
  assert.equal((await post({origin: 'https://evil.example', 'content-type': 'application/json'})).status, 403);
  assert.equal((await post({origin: 'https://go.example.com', 'content-type': 'text/plain'})).status, 415);
  assert.equal((await post({origin: 'https://go.example.com', 'content-type': 'application/json'}, '{')).status, 400);
  assert.equal((await post({origin: 'https://go.example.com', 'content-type': 'application/json'}, 'x'.repeat(20000))).status, 413);
  const ok = await post({origin: 'https://go.example.com', 'content-type': 'application/json'});
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await ok.json(), {success: true, got: 'quote'});
});

test('the rate limiter allows five per visitor per window', () => {
  const limited = createRateLimiter();
  const results = Array.from({length: 6}, () => limited('ip', 1000));
  assert.deepEqual(results, [false, false, false, false, false, true]);
  assert.equal(limited('other', 1000), false);
  assert.equal(limited('ip', 1000 + 15 * 60 * 1000), false);
});

test('both landing forms are live and post to the quote form', () => {
  for (const page of ['custom-window-treatments', 'motorized-shades']) {
    const html = readFileSync(new URL(`../dist/lp/${page}/index.html`, import.meta.url), 'utf8');
    const form = html.match(/<form class="landing-form"[\s\S]*?<\/form>/)[0];
    assert.match(form, /data-lead-form="quote"/);
    assert.match(form, /<button class="btn btn-primary" type="submit">Get Free Quote<\/button>/);
    assert.match(form, /name="website"/);
    assert.match(form, /class="lead-form-status"/);
    assert.doesNotMatch(form, /\bdisabled\b|Form preview/);
    for (const name of ['name', 'phone', 'email']) assert.match(form, new RegExp(`name="${name}"[^>]*required`));
    assert.doesNotMatch(html, /does not accept submissions/);
  }
});
