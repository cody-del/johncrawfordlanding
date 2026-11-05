// Cloudflare Turnstile: app.js puts an invisible human check on every lead form, and the
// function checks its token here before anything reaches GoHighLevel. This file is identical
// in johncrawfordcompany and johncrawfordlanding; one Turnstile widget serves both sites.
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TOKEN_FIELD = 'cf-turnstile-response';

// Resolves true when the request may go on. Without TURNSTILE_SECRET_KEY the check is off and
// the other checks still apply, so the code can ship before the Cloudflare keys exist.
export async function verifyHuman(token, ip, {fetcher = fetch, env = process.env} = {}) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  // Cloudflare's tokens are at most 2048 characters.
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new URLSearchParams({secret, response: token});
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const response = await fetcher(SITEVERIFY_URL, {method: 'POST', body, signal: AbortSignal.timeout(3000)});
    const result = await response.json();
    if (result?.success === true) return true;
    console.error(`[turnstile] token refused: ${(result?.['error-codes'] ?? []).join(',') || `HTTP ${response.status}`}`);
    return false;
  } catch (error) {
    // Cloudflare unreachable: let the lead through rather than lose it; the other checks still apply.
    console.error(`[turnstile] siteverify unavailable: ${error.name}`);
    return true;
  }
}
