import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {submitLead, MIN_FILL_MS} from '../netlify/lib/lead.mjs';
import {createLeadHandler} from '../netlify/lib/lead-http.mjs';

// These tests post without a Turnstile token; keep a build's real TURNSTILE_SECRET_KEY
// (Netlify sets it for production builds) from switching the human check on here.
delete process.env.TURNSTILE_SECRET_KEY;

const read = path => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const text = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const COMPANY = 'John Crawford Company';

// Optional A2P 10DLC SMS consent on both landing forms: two separate, unchecked, optional boxes.
test('both landing forms offer service and promotional SMS opt-ins, unchecked and optional', () => {
  for (const page of ['index.html', 'motorized-shades/index.html']) {
    const html = read(page);
    const form = html.match(/<form class="landing-form"[\s\S]*?<\/form>/)[0];
    const fieldset = form.match(/<fieldset class="landing-sms-consent">[\s\S]*?<\/fieldset>/)?.[0];
    assert.ok(fieldset, `${page}: SMS fieldset`);
    assert.match(fieldset, /<legend>SMS updates \(optional\)<\/legend>/);
    for (const name of ['sms_transactional', 'sms_marketing']) {
      const box = fieldset.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
      assert.ok(box, `${page}: ${name} checkbox`);
      assert.match(box, /type="checkbox"/);
      assert.doesNotMatch(box, /\bchecked\b|\brequired\b/, `${page}: ${name} must be unchecked and optional`);
      assert.match(box, /aria-describedby="sms-disclosure"/);
    }
    assert.ok(text(fieldset).includes(`I agree to receive service texts from ${COMPANY} about consultations, appointments, estimates, installations, repairs, and customer support.`));
    assert.ok(text(fieldset).includes(`I agree to receive promotional texts from ${COMPANY} about offers and product news.`));
    assert.ok(fieldset.includes('id="sms-disclosure"'));
    assert.ok(text(fieldset).includes('For either option: Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.'));
    for (const href of ['/privacy/', '/terms/', '/sms-consent/']) assert.ok(fieldset.includes(`href="${href}"`), `${page}: ${href} link`);
    // After the contact fields, before the submit button (where Turnstile is inserted).
    assert.ok(form.indexOf('name="email"') < form.indexOf('landing-sms-consent'));
    assert.ok(form.indexOf('landing-sms-consent') < form.indexOf('type="submit"'));
    assert.match(html, /<a href="\/sms-consent\/">SMS Terms<\/a>/, `${page}: footer SMS Terms link`);
  }
});

test('app.js sends the two SMS choices as booleans', () => {
  const app = read('app.js');
  assert.ok(app.includes(`payload.smsTransactionalOptIn = form.querySelector('[name="sms_transactional"]')?.checked === true;`));
  assert.ok(app.includes(`payload.smsMarketingOptIn = form.querySelector('[name="sms_marketing"]')?.checked === true;`));
  assert.ok(app.includes(':not([type="checkbox"])'), 'checkboxes keep their aria-describedby');
});

test('the policies carry the SMS clauses and the SMS consent page exists', () => {
  const privacy = text(read('privacy/index.html'));
  assert.ok(privacy.includes('Mobile Information and SMS'));
  assert.ok(privacy.includes('Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes.'));
  assert.ok(privacy.includes('Transactional and promotional SMS choices are collected separately.'));
  assert.ok(privacy.includes('whether you opt in to service texts, promotional texts, both or neither'));
  const terms = text(read('terms/index.html'));
  assert.ok(terms.includes('SMS Terms'));
  assert.ok(terms.includes('By selecting an SMS opt-in checkbox, you consent only to the message category described beside that checkbox.'));
  assert.ok(terms.includes('Carriers are not liable for delayed or undelivered messages.'));
  assert.ok(existsSync(new URL('../dist/sms-consent/index.html', import.meta.url)));
  const sms = read('sms-consent/index.html');
  assert.match(sms, /<h1>SMS Consent and Messaging Information<\/h1>/);
  assert.match(sms, /<meta name="robots" content="noindex, nofollow">/);
  for (const heading of ['How Website Visitors Opt In', 'Consent Is Specific and Voluntary', 'Mobile Information and Sharing', 'Message Types', 'Contact Us']) {
    assert.ok(sms.includes(`<h2>${heading}</h2>`), heading);
  }
  assert.ok(text(sms).includes(`${COMPANY} does not sell, rent, lease, or share SMS opt-in data, phone numbers, or consent records with third parties or affiliates for their marketing or promotional purposes.`));
  assert.ok(text(sms).includes('Effective November 25, 2026.'));
  assert.ok(sms.includes('(818) 884-5464'));
  for (const page of ['privacy/index.html', 'terms/index.html', 'accessibility/index.html', 'sms-consent/index.html']) {
    assert.match(read(page), /<a href="\/sms-consent\/"( aria-current="page")?>SMS Terms<\/a>/, `${page}: footer SMS Terms link`);
  }
});

const env = {GHL_PRIVATE_TOKEN: 'pit-test', GHL_LOCATION_ID: 'loc-test'};
const now = () => new Date('2026-11-25T08:00:00.000Z');
const lead = (extra = {}) => ({
  form: 'quote', page: '/', name: 'Ada Lovelace', phone: '(818) 555-0142', email: 'ada@example.com',
  'appointment-type': 'showroom', website: '', elapsedMs: MIN_FILL_MS + 500, ...extra,
});
function ghl() {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url, body: JSON.parse(init.body)});
    return new Response(JSON.stringify(url.endsWith('/notes') ? {} : {contact: {id: 'c-1'}}), {status: 200});
  };
  return {calls, fetcher};
}
// Through the real /api/lead handler, as app.js posts it.
async function post(data) {
  const {calls, fetcher} = ghl();
  const handler = createLeadHandler((body, options) => submitLead(body, {...options, fetcher, env, now}));
  const response = await handler(new Request('https://go.example.com/api/lead', {
    method: 'POST', headers: {origin: 'https://go.example.com', 'content-type': 'application/json'}, body: JSON.stringify(data),
  }), {ip: '1.2.3.4'});
  assert.equal(response.status, 200);
  return calls;
}

test('SMS opt-ins become tags (last) and note lines only when true', async () => {
  for (const [service, promo, tags] of [
    [true, true, ['sms-transactional-opt-in', 'sms-marketing-opt-in']],
    [true, false, ['sms-transactional-opt-in']],
    [false, true, ['sms-marketing-opt-in']],
    [false, false, []],
    ['true', 1, []],
  ]) {
    const calls = await post(lead({smsTransactionalOptIn: service, smsMarketingOptIn: promo}));
    assert.deepEqual(calls[0].body.tags, ['google_window treatments', 'showroom-appointment', ...tags], `${service}/${promo}`);
    const noteBody = calls[1].body.body;
    assert.equal(calls[0].body.customFields[0].field_value, noteBody);
    const lines = noteBody.split('\n');
    assert.deepEqual(lines.slice(-3), [
      `Service SMS opt-in: ${service === true ? 'Yes' : 'No'}`,
      `Promotional SMS opt-in: ${promo === true ? 'Yes' : 'No'}`,
      'SMS consent captured 2026-11-25T08:00:00.000Z from /',
    ]);
  }
});

test('without SMS fields the lead still goes through, recorded as No, with no SMS tags', async () => {
  const calls = await post(lead({page: '/motorized-shades/'}));
  assert.deepEqual(calls[0].body.tags, ['google_motorized shades', 'showroom-appointment']);
  assert.match(calls[1].body.body, /Service SMS opt-in: No\nPromotional SMS opt-in: No\nSMS consent captured 2026-11-25T08:00:00\.000Z from \/motorized-shades\/$/);
});

test('an odd page value is not written into the consent record', async () => {
  const calls = await post(lead({page: 'javascript:alert(1)', smsTransactionalOptIn: true}));
  assert.match(calls[1].body.body, /from unknown page$/);
});
