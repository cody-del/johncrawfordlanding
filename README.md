# John Crawford Company landing pages

Standalone static export of the two approved campaign landing pages, including the October 28, 2026 consultation and motorized-control copy updates.

## Routes

- `/`: Custom Window Treatments
- `/motorized-shades/`: Motorized Shades

The pages used to live at `/lp/custom-window-treatments/` and `/lp/motorized-shades/`; `dist/_redirects` sends those (and anything else under `/lp/`) to the new addresses with permanent (301) redirects, keeping query strings such as `gclid` and `utm_*`.

The pages retain the approved design, video heroes, reviews, product cards, benefits, appointment-only Woodland Hills section, and quote forms. Visitors can request a quote on the same page or call. The footer links to Accessibility (`/accessibility/`), Privacy Policy (`/privacy/`) and Terms of Service (`/terms/`) pages on the same domain; the quote form's privacy notice still opens a short summary dialog that links to the full policy. Run `python3 scripts/build-legal-pages.py` after changing the policy text.

## Local preview

No dependency installation or compilation is required. Use Node.js and Python 3:

```sh
npm run check
npm run preview
```

Open either route at `http://127.0.0.1:4318`, for example `http://127.0.0.1:4318/motorized-shades/`. The local Python server does not apply Netlify redirects.

## Editing

`dist/` is the deployable site and the editable source for this standalone repository:

- `dist/index.html` and `dist/motorized-shades/index.html`: page copy, sections, metadata, and form markup.
- `dist/styles.css` and `dist/landings.css`: shared brand styles and landing-page styles.
- `dist/app.js`: video, reviews, and dialog behavior.
- `dist/assets/`: the images, videos, and fonts used by these pages.

There is no dependency on the full website's homepage or page generators. Edit the HTML directly and run `npm run check` before publishing.

## Deployment

`netlify.toml` runs the checks and publishes `dist/` to the Netlify site `johncrawfordlp`, served at https://go.johncrawfordcompany.com. `dist/_redirects` holds the `/lp/` redirects; another host would need the same rules.

## Current integration status

Quote forms send leads to John Crawford Company's GoHighLevel location through `/api/lead` (`netlify/functions/lead.mjs`). The function upserts the contact with a source naming the page (for example `Google Ads Landing Page: Motorized Shades`) and, when the visitor picks one, `in-home-consultation` or `showroom-appointment`; the appointment choice is also written as a note. It refuses the hidden `website` field, submissions sent within 3 seconds of page load and more than 5 per visitor per 15 minutes. What the form sends is set in `netlify/lib/site.mjs`. Landing-page submissions receive a campaign tag: `google_window treatments` for `/`, or `google_motorized shades` for `/motorized-shades/`. The older `/lp/` routes map to the same tags. The generic `google_landing_page` tag is no longer sent.

The Netlify site needs two environment variables: `GHL_PRIVATE_TOKEN` (a private integration token made inside John Crawford's sub-account, with contact and note write access) and `GHL_LOCATION_ID`. John Crawford's GHL lead workflows should trigger on `google_window treatments` or `google_motorized shades`. `npm run check` also runs `tests/lead.test.mjs`.

Phone links are active. No advertising pixels or conversion tracking were added by this export. Pages keep `noindex, nofollow` (they are ad landing pages); their canonical and social URLs are on https://go.johncrawfordcompany.com.

## Spam protection

Every lead form goes through these checks in `/api/lead` before anything reaches GHL:

- **Cloudflare Turnstile.** `dist/app.js` adds an invisible human check to each form. Visitors only see a checkbox if Cloudflare wants one. `netlify/lib/turnstile.mjs` (identical in `johncrawfordcompany` and `johncrawfordlanding`) checks the token with Cloudflare and refuses the lead with a 403 when the token is missing or refused. If Cloudflare can't be reached, the lead goes through rather than being lost. One widget, made in the gbp@shadestrategy.com Cloudflare account, covers `www.johncrawfordcompany.com`, `johncrawfordcompany.com` and `go.johncrawfordcompany.com`. Its site key is `TURNSTILE_SITE_KEY` in `dist/app.js` (public, in the page) and its secret is the Netlify variable `TURNSTILE_SECRET_KEY` (Production, Functions, secret). Other hosts, such as deploy previews, use Cloudflare's always-pass test site key; give Deploy Previews the test secret `1x0000000000000000000000000000000AA`, or no secret, which switches the check off. Netlify functions read the secret at deploy time, so redeploy after setting it.
- **Netlify rate limit.** `netlify/functions/lead.mjs` limits each visitor (IP + domain) to 10 requests per 3 minutes. Netlify counts these itself, for every copy of the function and across restarts, and answers with a 429.
- **In the function:** a hidden `website` field, a 3-second minimum after page load, same-origin JSON only, size limits, field checks, and an in-memory limit of 5 leads per visitor per 15 minutes.

## Export source

The hero videos and posters now match the main website's corrected `20261104-color2` edit, including the coastal ocean detail. Keep the desktop and mobile exports synchronized with that approved edit.

Originally exported from `cody-del/johncrawfordcompany`, commit `b899eb9` (landing-page copy alignment). Later landing-page updates are maintained in this standalone repository.

This repository contains the two landing pages and their public runtime dependencies. It excludes the main website pages, campaign drafts, client intake records, CRM configuration, credentials, and local review artifacts.
