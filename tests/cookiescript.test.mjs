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

