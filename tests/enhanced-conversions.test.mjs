import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const text = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

// Enhanced conversions, email only, on the Ads lead conversion. The privacy policy promises mobile
// numbers are never shared, so phone (and name, message, SMS choices) must never reach Google.
test('the Ads lead conversion carries the email only, on the event itself', () => {
  const js = read('app.js');
  // user_data is set with the email only, right before the Ads conversion, after GHL confirmed the lead.
  const setAt = js.indexOf("gtag('set', 'user_data', { email: leadEmail })");
  const convAt = js.indexOf("gtag('event', 'conversion'");
  assert.ok(setAt > js.indexOf('result.success !== true') && setAt < convAt, 'user_data set right before the conversion');
  assert.equal(js.split("gtag('set', 'user_data'").length - 1, 1, 'user_data is set in one place only');
  assert.match(js.slice(convAt, convAt + 200), /send_to: 'AW-853283675\/sDwoCL-Q6uEcENum8JYD'/);
  // The email is read before form.reset() clears it, trimmed and lowercased.
  assert.ok(js.indexOf("const leadEmail = String(payload.email || '').trim().toLowerCase();") < js.indexOf('form.reset();'));
  // No phone, no name, no address anywhere in what goes to Google.
  assert.doesNotMatch(js, /phone_number|sha256_phone|first_name|last_name|street/);
  // GA4 never gets user data.
  const ga4 = js.split('\n').find(l => l.includes("gtag('event', 'generate_lead'"));
  assert.doesNotMatch(ga4, /user_data|email/);
});

test('the Ads tag config allows enhanced conversions on both pages', () => {
  for (const page of ['index.html', 'motorized-shades/index.html']) {
    assert.match(read(page), /gtag\('config','AW-853283675',\{'allow_enhanced_conversions':true\}\)/);
  }
});

test('both privacy texts disclose the hashed email and that phone and SMS choices are never sent', () => {
  const full = text(read('privacy/index.html'));
  assert.match(full, /hashed \(one-way encrypted\) copy of the email address you entered/);
  assert.match(full, /Your name, phone number, message and SMS choices are never sent to Google Ads/);
  assert.match(full, /Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes/);
  for (const page of ['index.html', 'motorized-shades/index.html']) {
    const dialog = text(read(page).match(/<dialog class="landing-info-dialog" id="landing-privacy-dialog"[\s\S]*?<\/dialog>/)[0]);
    assert.match(dialog, /hashed \(one-way encrypted\) copy of your email address/);
    assert.match(dialog, /your name, phone number, message and SMS choices are never sent/);
    assert.doesNotMatch(dialog, /ChatGPT Sites|audience-tracking/);
  }
});
