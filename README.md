# John Crawford Company landing pages

Standalone static export of the two approved campaign landing pages, including the October 28, 2026 consultation and motorized-control copy updates.

## Routes

- `/lp/custom-window-treatments/`
- `/lp/motorized-shades/`

The pages retain the approved design, video heroes, reviews, product cards, benefits, appointment-only Woodland Hills section, and quote forms. Visitors can request a quote on the same page or call. Privacy and accessibility information open in dialogs.

## Local preview

No dependency installation or compilation is required. Use Node.js and Python 3:

```sh
npm run check
npm run preview
```

Open either route at `http://127.0.0.1:4318`, for example `http://127.0.0.1:4318/lp/custom-window-treatments/`. The local Python server does not apply Netlify redirects.

## Editing

`dist/` is the deployable site and the editable source for this standalone repository:

- `dist/lp/*/index.html`: page copy, sections, metadata, and form markup.
- `dist/styles.css` and `dist/landings.css`: shared brand styles and landing-page styles.
- `dist/app.js`: video, reviews, and dialog behavior.
- `dist/assets/`: the images, videos, and fonts used by these pages.

There is no dependency on the full website's homepage or page generators. Edit the HTML directly and run `npm run check` before publishing.

## Deployment

`netlify.toml` runs the checks and publishes `dist/`. Connect this repository to the intended Netlify site when ready. `dist/_redirects` sends the root URL to the custom-window-treatments landing page; both existing campaign routes remain available. Other hosts must serve `dist/` from the domain root and configure the equivalent root redirect if desired.

## Current integration status

Quote forms remain disabled design previews pending GoHighLevel integration and verified lead delivery. Phone links are active. No advertising pixels or conversion tracking were added by this export. Pages retain `noindex, nofollow` and the existing review-domain canonical/social metadata; configure the intended production domain when launching.

## Export source

Copied without page or asset changes from `cody-del/johncrawfordcompany`, commit `b899eb9` (landing-page copy alignment). The later website-only commits were checked and do not change these landing pages or their assets.

This repository contains the two landing pages and their public runtime dependencies. It excludes the main website pages, campaign drafts, client intake records, CRM configuration, credentials, and local review artifacts.
