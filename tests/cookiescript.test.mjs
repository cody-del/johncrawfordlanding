import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

// The CookieScript banner (John Crawford's CookieScript account) must load on every page,
// once, at the top of <head> so it runs before any other script.
const TAG = '<script type="text/javascript" charset="UTF-8" src="https://cdn.cookie-script.com/s/bb49fbb8483ced09e550fab9f04307c1.js"></script>';
const dist = new URL('../dist/', import.meta.url).pathname;
const pages = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? pages(path) : name.endsWith('.html') ? [path] : [];
});

test('every page loads the CookieScript banner once, first in <head>', () => {
  const files = pages(dist);
  assert.ok(files.length > 0);
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    assert.equal(html.split(TAG).length - 1, 1, `${file}: CookieScript tag must appear exactly once`);
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    assert.ok(head.includes(TAG), `${file}: CookieScript tag must be in <head>`);
    assert.ok(head.indexOf(TAG) < head.indexOf('<script', head.indexOf('<meta charset')) + 1, `${file}: CookieScript must be the first script`);
  }
});

// The Meta Pixel only runs through CookieScript, after the visitor allows Targeting cookies.
const PIXEL_OPEN = '<script type="text/plain" data-cookiescript="accepted" data-cookiecategory="targeting">';
const wantsPixel = file => ['index.html', 'motorized-shades/index.html'].some(page => file.endsWith('/dist/' + page));

test('the Meta Pixel is consent-gated, after CookieScript, and has no noscript fallback', () => {
  let withPixel = 0;
  for (const file of pages(dist)) {
    const html = readFileSync(file, 'utf8');
    const inits = html.split("fbq('init','4317054311941000')").length - 1;
    assert.doesNotMatch(html, /facebook\.com\/tr\?/, `${file}: the noscript image would track without consent`);
    assert.doesNotMatch(html, /<script>[^<]*fbevents\.js/, `${file}: the pixel must not run outside CookieScript`);
    if (!wantsPixel(file)) { assert.equal(inits, 0, `${file}: no pixel expected`); continue; }
    assert.equal(inits, 1, `${file}: pixel must appear exactly once`);
    assert.ok(html.includes("fbq('dataProcessingOptions',['LDU'],0,0);fbq('init','4317054311941000')"), `${file}: Limited Data Use must be set right before init`);
    const pixel = html.indexOf(PIXEL_OPEN);
    assert.ok(pixel > html.indexOf(TAG) && pixel < html.indexOf('</head>'), `${file}: pixel must be gated and come after CookieScript in <head>`);
    withPixel++;
  }
  assert.ok(withPixel > 0);
});

test('the Lead event fires only after a confirmed lead, without contact details', () => {
  const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const calls = app.match(/fbq\('track', 'Lead'[^)]*\)/g) || [];
  assert.deepEqual(calls, ["fbq('track', 'Lead')"]);
  assert.ok(app.indexOf("fbq('track', 'Lead')") > app.indexOf("Thank you. We received your request"), 'Lead must follow the confirmed thank-you');
});

// ClickCease (click-fraud protection for John Crawford's ads) runs on every page, outside the
// cookie consent gate: early in <head> after CookieScript, plus its noscript frame first in <body>.
const CLICKCEASE = '<script async src="https://ob.esnbranding.com/i/812741747104d2a36e3927a603f46db5.js" class="ct_clicktrue"></script>';
const CLICKCEASE_NOSCRIPT = '<noscript><iframe src="https://ob.esnbranding.com/ns/812741747104d2a36e3927a603f46db5.html?ch=" width="0" height="0" style="display:none"></iframe></noscript>';

test('every page loads ClickCease once, after CookieScript, with its noscript frame first in <body>', () => {
  for (const file of pages(dist)) {
    const html = readFileSync(file, 'utf8');
    assert.equal(html.split(CLICKCEASE).length - 1, 1, `${file}: ClickCease script must appear exactly once`);
    assert.ok(html.indexOf(CLICKCEASE) > html.indexOf(TAG) && html.indexOf(CLICKCEASE) < html.indexOf('</head>'), `${file}: ClickCease must follow CookieScript in <head>`);
    assert.equal(html.split(CLICKCEASE_NOSCRIPT).length - 1, 1, `${file}: ClickCease noscript must appear exactly once`);
    assert.match(html, /<body[^>]*>\s*<noscript><iframe src="https:\/\/ob\.esnbranding\.com\/ns\//, `${file}: ClickCease noscript must be first in <body>`);
  }
});


// Google Ads (AW-853283675): the Google tag with the website call conversion on the two landing
// pages, after CookieScript (which sets Google Consent Mode first), and none on the policy pages.
const ADS_ID = 'AW-853283675';
const ADS_LOADER = `<script async src="https://www.googletagmanager.com/gtag/js?id=${ADS_ID}"></script>`;
const ADS_CALL = `gtag('config','${ADS_ID}/YQF9CNz94rAdENum8JYD',{'phone_conversion_number':'(818) 884-5464'});`;

test('the Google Ads tag and call conversion load once on each landing page, after CookieScript', () => {
  let withTag = 0;
  for (const file of pages(dist)) {
    const html = readFileSync(file, 'utf8');
    if (!wantsPixel(file)) { assert.ok(!html.includes(ADS_ID), `${file}: no Google Ads tag expected`); continue; }
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    assert.equal(html.split(ADS_LOADER).length - 1, 1, `${file}: Google tag loader must appear exactly once`);
    assert.ok(head.indexOf(ADS_LOADER) > head.indexOf(TAG) && head.indexOf(ADS_LOADER) > head.indexOf(CLICKCEASE), `${file}: Google tag must follow CookieScript and ClickCease`);
    assert.equal(head.split(`gtag('config','${ADS_ID}');`).length - 1, 1, `${file}: Google tag config`);
    assert.equal(head.split(ADS_CALL).length - 1, 1, `${file}: call conversion config`);
    assert.ok(html.includes('(818) 884-5464'), `${file}: the number Google swaps must be on the page`);
    withTag++;
  }
  assert.equal(withTag, 2);
});

test('the Google Ads lead conversion fires once, after a confirmed lead, keyed to the GHL contact', () => {
  const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const calls = app.match(/gtag\('event', 'conversion'[^;]*;/g) || [];
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes(`send_to: '${ADS_ID}/sDwoCL-Q6uEcENum8JYD'`));
  assert.ok(calls[0].includes("transaction_id: 'lead_' + result.contactId"));
  assert.ok(app.indexOf(calls[0]) > app.indexOf("result.success !== true"), 'conversion must follow the GHL success check');
  assert.ok(app.indexOf(calls[0]) > app.indexOf("Thank you. We received your request"), 'conversion must follow the confirmed thank-you');
});

test('the privacy policy discloses Google Ads and Consent Mode', () => {
  const policy = readFileSync(join(dist, 'privacy/index.html'), 'utf8');
  assert.ok(policy.includes('Google tag from Google Ads'));
  assert.ok(policy.includes('Google Consent Mode'));
  assert.ok(policy.includes('Google forwarding number'));
});
