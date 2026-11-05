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
