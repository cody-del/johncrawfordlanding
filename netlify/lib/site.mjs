// What this site's quote form sends to GoHighLevel; netlify/lib/lead.mjs does the sending.
export const PHONE = '(818) 884-5464';

// Each landing page sends its own campaign tag to GoHighLevel.
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
