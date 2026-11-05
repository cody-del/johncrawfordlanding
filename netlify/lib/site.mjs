// What this site's quote form sends to GoHighLevel; netlify/lib/lead.mjs does the sending.
export const PHONE = '(818) 884-5464';

// Every landing page lead gets this tag, as on Shade Strategy's other ad landing
// pages. John Crawford's GHL lead workflow should trigger on it; renaming it
// detaches every new lead from that workflow without any error, so change the
// GHL trigger in the same sitting.
export const LEAD_TAG = 'google_landing_page';

// Keep the workflow tag above and add the requested campaign tag per page.
export const PAGE_LEAD_TAGS = {
  '/': 'google_window treatments',
  '/motorized-shades/': 'google_motorized shades',
  '/lp/custom-window-treatments/': 'google_window treatments',
  '/lp/motorized-shades/': 'google_motorized shades',
};

// Each form names its fields. A field with `tags` adds the tag for its value,
// one with `contactField` sets that contact field, and every answer is also
// written in the contact's note.
export const FORMS = {
  quote: {
    source: 'Google Ads Landing Page',
    pages: {
      '/': 'Google Ads Landing Page: Custom Window Treatments',
      '/motorized-shades/': 'Google Ads Landing Page: Motorized Shades',
      // The pages' old addresses, for a page someone opened before they moved (dist/_redirects).
      '/lp/custom-window-treatments/': 'Google Ads Landing Page: Custom Window Treatments',
      '/lp/motorized-shades/': 'Google Ads Landing Page: Motorized Shades',
    },
    fields: [
      {
        name: 'appointment-type', label: 'I’d like to schedule', max: 20,
        options: {'in-home': 'Free in-home consultation', showroom: 'Showroom appointment'},
        tags: {'in-home': 'in-home-consultation', showroom: 'showroom-appointment'},
      },
    ],
  },
};
