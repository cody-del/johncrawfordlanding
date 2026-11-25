import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const text = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const LANDINGS = ['index.html', 'motorized-shades/index.html'];

// GA4 (same property as www) loads only through CookieScript's Performance category and only on the live go. host.
test('landing pages load GA4 only after Performance consent and only on go.johncrawfordcompany.com', () => {
  for (const page of LANDINGS) {
    const html = read(page);
    const snippet = html.match(/<script type="text\/plain" data-cookiescript="accepted" data-cookiecategory="performance">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(snippet, `${page}: consent-gated GA4 snippet`);
    assert.match(snippet, /^if\(location\.hostname==='go\.johncrawfordcompany\.com'\)/);
    assert.match(snippet, /gtag\('config','G-H1RC8T47T3'\)/);
    // The only G- id anywhere on the page is John Crawford's.
    assert.deepEqual([...new Set(html.match(/G-[A-Z0-9]{8,}/g))], ['G-H1RC8T47T3']);
    // GA4 never loads outside the gated snippet.
    assert.equal(html.split('gtag/js?id=G-').length - 1, 1);
  }
});

test('GA4 events name send_to so they never reach Google Ads, and stay on the go. host', () => {
  const js = read('app.js');
  assert.match(js, /const GA4_ID = 'G-H1RC8T47T3';/);
  assert.match(js, /const GA4_HOST = 'go\.johncrawfordcompany\.com';/);
  for (const event of ['generate_lead', 'phone_click']) {
    const line = js.split('\n').find(l => l.includes(`gtag('event', '${event}'`));
    assert.ok(line, `${event} event`);
    assert.match(line, /send_to: GA4_ID/);
  }
  // generate_lead fires only after GHL confirmed the lead (after the Ads conversion) and only on the live host.
  assert.ok(js.indexOf("'generate_lead'") > js.indexOf("gtag('event', 'conversion'"));
  assert.match(js, /location\.hostname === GA4_HOST && typeof gtag === 'function'\) gtag\('event', 'generate_lead'/);
});

test('both quote forms show the Hunter Douglas trust line under the heading', () => {
  for (const page of LANDINGS) {
    const html = read(page);
    assert.match(html, /<h2 id="quote-heading">Get a Free Quote<\/h2>\n\s*<p class="landing-trust">Authorized Hunter Douglas Dealer<\/p>/);
  }
});

test('privacy policy discloses GA4 and no longer says there is no analytics', () => {
  const privacy = text(read('privacy/index.html'));
  assert.match(privacy, /If you allow Performance cookies, we use Google Analytics 4 \(Google LLC\)/);
  assert.match(privacy, /never receives the details you type into a form or your SMS choices/);
  assert.doesNotMatch(privacy, /audience-tracking analytics/);
});
