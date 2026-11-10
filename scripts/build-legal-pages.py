"""Build the Privacy Policy, Terms of Service and Accessibility pages for the landing domain.

Run `python3 scripts/build-legal-pages.py` after changing the text below, then `npm run check`.
The pages use the landing branding and stay out of search results. Their only script, dist/legal.js,
points the quote links back to the campaign page the visitor came from and keeps the footer year current.
"""
from datetime import date
from html import escape
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / 'dist'
# Default quote link; legal.js swaps in the landing page the visitor came from.
QUOTE = '/#contact'
QUOTE_LINK = f'href="{QUOTE}" data-quote-link'
PHONE = '<a href="tel:+18188845464">(818) 884-5464</a>'
EMAIL = '<a href="mailto:john@johncrawford.com">john@johncrawford.com</a>'
LINKS = [('/accessibility/', 'Accessibility'), ('/privacy/', 'Privacy Policy'), ('/terms/', 'Terms of Service')]

PAGES = [
    {
        'slug': '/privacy/', 'name': 'Privacy Policy',
        'description': 'How John Crawford Company handles quote requests and contact information sent through these pages.',
        'body': f'''
  <h1>Privacy Policy</h1>
  <p class="legal-date">Effective November 6, 2026.</p>
  <p>This policy describes the information John Crawford Company collects through these pages and how to contact us about it.</p>
  <h2>Information you provide</h2>
  <p>When you request a quote, we receive the name, phone number and email you enter and the appointment type you choose. If you call or email us, we receive the contact information and project details you share.</p>
  <h2>How your information is used</h2>
  <p>We use your information to respond to your request, discuss your project and arrange a showroom appointment or in-home consultation.</p>
  <h2>Service providers</h2>
  <p>Quote requests are kept in HighLevel, the customer relationship system we use to manage inquiries. These pages are hosted through Netlify and ChatGPT Sites. Hosting providers may process technical information, such as IP addresses, browser details and request logs, to deliver and secure the pages. Our forms use Cloudflare Turnstile to confirm that a person, not an automated program, is sending them; Cloudflare receives browser and device information for that check.</p>
  <h2>Tracking</h2>
  <p>If you allow Targeting cookies in our cookie notice, we use the Meta Pixel (Meta Platforms) to measure our ads and to show our ads on Facebook and Instagram to people who visited these pages. It records pages viewed and that a quote or appointment request was sent, never the details you type into a form. For visitors in California, we turn on Meta's Limited Data Use setting, which restricts how Meta may use this data. If you decline or later turn Targeting off in the cookie settings, the Meta Pixel does not run. We do not use audience-tracking analytics. To protect our advertising from fraudulent clicks, our pages also use ClickCease, a click-fraud detection service from CHEQ. It receives technical information about each visit, such as IP address, browser and device details, to identify automated or invalid ad clicks. Because it is a security measure, it runs for every visitor. A cookie notice from CookieScript lets you review and change your cookie choices; it saves your choice in a cookie on your device. The pages do not change their behavior in response to browser Do Not Track signals.</p>
  <h2>Your privacy requests</h2>
  <p>To ask about access, correction or deletion of information you provided to us, call {PHONE} or email {EMAIL}. We may need to verify your request and retain records required for an ongoing project or by law.</p>
  <h2>Policy updates</h2>
  <p>We will post changes on this page and update the effective date when this policy changes.</p>''',
    },
    {
        'slug': '/terms/', 'name': 'Terms of Service',
        'description': 'Terms for using these John Crawford Company pages and requesting a quote, showroom appointment or in-home consultation.',
        'body': f'''
  <h1>Terms of Service</h1>
  <p class="legal-date">Effective November 5, 2026.</p>
  <p>These terms apply to your use of these John Crawford Company pages. By using them, you agree to these terms.</p>
  <h2>Using these pages</h2>
  <p>These pages give general information about our window treatments and services. Product images show manufacturer collections and are not presented as John Crawford Company installations. Please do not misuse the pages, send false information or submit automated requests through the quote form.</p>
  <h2>Quote requests and consultations</h2>
  <p>Requesting a quote or consultation does not place an order or create an obligation to buy. Product choices, measurements, pricing, installation timing and other project details are confirmed with you directly before anything is ordered. Product features, colors and availability are set by the manufacturers and may change.</p>
  <h2>Showroom visits</h2>
  <p>Showroom visits are by appointment only. Call {PHONE} or use the <a {QUOTE_LINK}>quote form</a> to arrange a time.</p>
  <h2>Content and trademarks</h2>
  <p>Text, photos and logos on these pages belong to John Crawford Company or are used with permission. Product and brand names are trademarks of their respective owners.</p>
  <h2>Privacy</h2>
  <p>Our <a href="/privacy/">Privacy Policy</a> explains how we handle the information you send through these pages.</p>
  <h2>Page information and liability</h2>
  <p>We work to keep these pages accurate, but they are provided as is and may contain errors or be unavailable at times. To the extent permitted by law, John Crawford Company is not liable for losses arising from use of these pages. Product warranties are provided by the manufacturers and are explained with your project.</p>
  <p>These terms are governed by the laws of the State of California.</p>
  <h2>Changes to these terms</h2>
  <p>We will post changes on this page and update the effective date when these terms change.</p>
  <h2>Contact us</h2>
  <p>Call John Crawford Company at {PHONE} or email {EMAIL}.</p>''',
    },
    {
        'slug': '/accessibility/', 'name': 'Accessibility',
        'description': 'Need help using these John Crawford Company pages? Call (818) 884-5464 or email john@johncrawford.com.',
        'body': f'''
  <h1>Accessibility</h1>
  <p>We want everyone to be able to learn about our window treatments and request a quote. We are working to make these pages easier to use.</p>
  <h2>Need help using these pages?</h2>
  <p>If you have difficulty reading a page or requesting a quote, call {PHONE} or email {EMAIL}.</p>
  <p>Tell us which page or feature caused the problem and how you would like us to contact you. We can also discuss products, quote requests and consultations by phone.</p>
  <p>Showroom visits are by appointment only.</p>
  <p class="legal-date">Statement reviewed November 5, 2026.</p>''',
    },
]


def render(page):
    title = f"{page['name']} | John Crawford Company"
    nav = '\n        '.join(
        f'<a href="{href}" aria-current="page">{label}</a>' if href == page['slug'] else f'<a href="{href}">{label}</a>'
        for href, label in LINKS)
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script type="text/javascript" charset="UTF-8" src="https://cdn.cookie-script.com/s/bb49fbb8483ced09e550fab9f04307c1.js"></script>
  <script async src="https://ob.esnbranding.com/i/812741747104d2a36e3927a603f46db5.js" class="ct_clicktrue"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(page['description'])}">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/assets/fonts.css?v=fonts-2">
  <link rel="stylesheet" href="/styles.css?v=appointments-1">
  <link rel="stylesheet" href="/landings.css?v=appointment-options-1">
  <link rel="stylesheet" href="/legal.css?v=legal-1">
  <script src="/legal.js?v=legal-1" defer></script>
</head>
<body class="landing-page landing-legal">
<noscript><iframe src="https://ob.esnbranding.com/ns/812741747104d2a36e3927a603f46db5.html?ch=" width="0" height="0" style="display:none"></iframe></noscript>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner">
      <a class="brand" href="/"><img src="/assets/john-crawford-logo.webp" alt="John Crawford Company — Window Treatments home" width="1672" height="941"></a>
      <div class="landing-header-actions"><span class="landing-header-number">(818) 884-5464</span><a class="btn btn-showroom-contact landing-call-cta" href="tel:+18188845464">Call Us</a>
      <a class="btn btn-primary header-cta" {QUOTE_LINK}>Get Free Quote</a></div>
      </div></header>
<main id="main" class="section legal-page"><div class="container legal-readable">{page['body']}
</div></main>
<footer class="site-footer" id="footer">
      <img class="footer-color-rule" src="/assets/brand-color-rule.png" alt="" width="3000" height="12" loading="lazy" aria-hidden="true">
      <div class="container footer-bottom"><p>© <span data-year>{date.today().year}</span> John Crawford Company. All rights reserved.</p><nav class="landing-footer-information" aria-label="Policies">
        {nav}
      </nav></div></footer>
<div class="mobile-contact" aria-label="Quick contact">
    <a href="tel:+18188845464">Call Us</a>
    <a {QUOTE_LINK}>Get Free Quote</a>
  </div>
</body>
</html>
'''


for page in PAGES:
    target = DIST / page['slug'].strip('/') / 'index.html'
    target.parent.mkdir(exist_ok=True)
    target.write_text(render(page))
    print(page['slug'])
