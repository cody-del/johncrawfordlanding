"""Check standalone landing-page routes, conversion links, and local assets."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re

ROOT = Path(__file__).resolve().parents[1] / 'dist'
PAGES = {Path('lp/custom-window-treatments/index.html'), Path('lp/motorized-shades/index.html')}


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


assert {p.relative_to(ROOT) for p in ROOT.rglob('*.html')} == PAGES, 'Expected only the two landing pages'
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
        page = Page()
        page.feed(path.read_text())
        assert page.headings == 1, f'{relative}: expected one H1'
        assert 'contact' in page.ids, f'{relative}: missing quote form'
        for href in page.links:
            assert href.startswith('#') or href == 'tel:+18188845464', f'{relative}: unexpected outbound link: {href}'
            if href.startswith('#'):
                assert unquote(href[1:]) in page.ids, f'{relative}: missing anchor: {href}'
        refs = page.refs
    elif path.suffix == '.css':
        refs = re.findall(r'url\([\s\x22\x27]*([^\)\x22\x27]+)', path.read_text())
    for ref in refs:
        url = urlsplit(ref)
        if url.scheme or url.netloc or not url.path:
            continue
        asset = Path(unquote(url.path).lstrip('/')) if url.path.startswith('/') else relative.parent / unquote(url.path)
        pending.append(asset)

print(f'Both landing pages passed; {len(checked)} page and dependency files verified.')
