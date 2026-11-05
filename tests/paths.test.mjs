import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('the old /lp/ addresses redirect permanently to the new ones', () => {
  const rules = read('_redirects').split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/));
  assert.deepEqual(rules, [
    ['/lp/custom-window-treatments', '/', '301'],
    ['/lp/motorized-shades', '/motorized-shades/', '301'],
    ['/lp/*', '/', '301'],
  ]);
});

test('each page names its own go.johncrawfordcompany.com address and stays out of search', () => {
  for (const [path, url] of [['index.html', 'https://go.johncrawfordcompany.com/'], ['motorized-shades/index.html', 'https://go.johncrawfordcompany.com/motorized-shades/']]) {
    const html = read(path);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${path}: canonical`);
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${path}: og:url`);
    assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'), `${path}: noindex`);
    assert.doesNotMatch(html, /chatgpt\.site|\/lp\//);
  }
  for (const path of ['privacy/index.html', 'terms/index.html', 'accessibility/index.html']) assert.doesNotMatch(read(path), /\/lp\//);
});
