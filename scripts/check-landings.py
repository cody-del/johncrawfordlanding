"""Check standalone landing-page routes, conversion links, and local assets."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re

ROOT = Path(__file__).resolve().parents[1] / 'dist'
LANDINGS = {Path('index.html'), Path('motorized-shades/index.html')}
LEGAL = {Path('privacy/index.html'), Path('terms/index.html'), Path('accessibility/index.html')}
PAGES = LANDINGS | LEGAL
POLICY_LINKS = {'/accessibility/', '/privacy/', '/terms/'}
LEGAL_LINKS = POLICY_LINKS | {'/', '/#contact', 'mailto:john@johncrawford.com'}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.links = []
        self.ids = set()
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            assert attrs['id'] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs['id'])
        self.headings += tag == 'h1'
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        for key in ('src', 'poster', 'data-desktop-src', 'data-mobile-src'):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if tag == 'link' and attrs.get('href'):
            self.refs.append(attrs['href'])
        if attrs.get('srcset'):
            self.refs.extend(item.strip().split()[0] for item in attrs['srcset'].split(','))


assert {p.relative_to(ROOT) for p in ROOT.rglob('*.html')} == PAGES, 'Expected the two landing pages and three policy pages'
pending = list(PAGES)
checked = set()
while pending:
    relative = pending.pop()
    path = (ROOT / relative).resolve()
    assert ROOT.resolve() in path.parents, f'Asset escapes the publish directory: {relative}'
    assert path.is_file(), f'Missing asset: {relative}'
    if path in checked:
        continue
    checked.add(path)
    refs = []
    if path.suffix == '.html':
        text = path.read_text()
        page = Page()
        page.feed(text)
        assert page.headings == 1, f'{relative}: expected one H1'
        assert 'name="robots" content="noindex, nofollow"' in text, f'{relative}: must stay out of search results'
        assert POLICY_LINKS <= set(page.links), f'{relative}: footer must link Accessibility, Privacy Policy and Terms of Service'
        allowed = POLICY_LINKS if relative in LANDINGS else LEGAL_LINKS
        if relative in LANDINGS:
            assert 'contact' in page.ids, f'{relative}: missing quote form'
        else:
            scripts = re.findall(r'<script\b[^>]*>', text)
            # The CookieScript banner (every page) and legal.js are the only scripts on the policy pages.
            cookiescript = '<script type="text/javascript" charset="UTF-8" src="https://cdn.cookie-script.com/s/bb49fbb8483ced09e550fab9f04307c1.js">'
            clickcease = '<script async src="https://ob.esnbranding.com/i/812741747104d2a36e3927a603f46db5.js" class="ct_clicktrue">'
            assert scripts == [cookiescript, clickcease, '<script src="/legal.js?v=legal-1" defer>'], f'{relative}: policy pages load only the cookie banner, ClickCease and legal.js'
        for href in page.links:
            assert href.startswith('#') or href == 'tel:+18188845464' or href in allowed, f'{relative}: unexpected outbound link: {href}'
            if href.startswith('#'):
                assert unquote(href[1:]) in page.ids, f'{relative}: missing anchor: {href}'
            elif href.startswith('/'):
                url = urlsplit(href)
                target = Path(url.path.strip('/')) / 'index.html' if url.path != '/' else None
                assert target is None or target in PAGES, f'{relative}: link to a missing page: {href}'
                if target and url.fragment:
                    other = Page()
                    other.feed((ROOT / target).read_text())
                    assert unquote(url.fragment) in other.ids, f'{relative}: {href} points to a missing anchor'
        refs = page.refs
    elif path.suffix == '.css':
        refs = re.findall(r'url\([\s\x22\x27]*([^\)\x22\x27]+)', path.read_text())
    for ref in refs:
        url = urlsplit(ref)
        if url.scheme or url.netloc or not url.path:
            continue
        asset = Path(unquote(url.path).lstrip('/')) if url.path.startswith('/') else relative.parent / unquote(url.path)
        pending.append(asset)

print(f'Landing and policy pages passed; {len(checked)} page and dependency files verified.')
