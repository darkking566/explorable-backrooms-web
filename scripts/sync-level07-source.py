"""Build local, script-free reading copies of the three approved public wiki pages.
No third-party Python packages. Images retain their original separate credits.
"""
from html.parser import HTMLParser
from html import escape
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'level0_7'
BASE = 'https://backrooms-wiki-cn.wikidot.com/level-0-7'

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)
    def find(self, pred):
        found = [self] if pred(self) else []
        for c in self.children:
            if isinstance(c, Node): found.extend(c.find(pred))
        return found

class Tree(HTMLParser):
    VOID = {'img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'wbr', 'area', 'embed'}
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node('root')
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.current)
        self.current.children.append(n)
        if tag not in self.VOID: self.current = n
    def handle_endtag(self, tag):
        n = self.current
        while n.parent:
            if n.tag == tag:
                self.current = n.parent
                break
            n = n.parent
    def handle_data(self, value): self.current.children.append(value)

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'BackroomsWeb-SourceArchive/1.0'})
    with urllib.request.urlopen(req, timeout=40) as response: return response.read()

STYLE = '''body{margin:0;background:#f2eddd;color:#302b22;font:16px/1.85 Georgia,"Noto Serif TC",serif}main{max-width:760px;margin:auto;padding:28px}a{color:#766022;overflow-wrap:anywhere}h1,h2,h3,h4,h5{line-height:1.4;color:#53431d}h1{font-size:25px;margin-top:40px}h2{font-size:21px}img{display:block;max-width:100%;max-height:480px;object-fit:contain;margin:20px auto}blockquote{margin:20px 0;padding:10px 20px;border-left:3px solid #bba568;background:#e9e1ca}pre{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bdb394;padding:8px}.source{font:13px/1.6 sans-serif;border-bottom:1px solid #bdb394;padding-bottom:18px}section{margin:24px 0}.tabtitle{padding:10px;border-bottom:1px solid #b6a374}hr{border:0;border-top:1px solid #bdb394}'''

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'archive').mkdir(exist_ok=True)
    (OUT / 'images').mkdir(exist_ok=True)
    pages, images, image_map = [], [], {}
    for index, slug in enumerate(['discovery', 'records', 'verified']):
        url = BASE + (f'/offset/{index}' if index else '')
        data = fetch(url)
        tree = Tree(data.decode('utf-8'))
        content = tree.root.find(lambda n: n.attrs.get('id') == 'page-content')[0]
        # The author's modal is not the start of the in-world file. Keep its full
        # contents at the end rather than exposing the original modal's close UI.
        for modal in content.find(lambda n: 'modalcontainer' in n.attrs.get('class', '').split()):
            modal.parent.children.remove(modal)
            content.children.append(modal)
        pages.append((slug, url, content, hashlib.sha256(data).hexdigest()))
        for img in content.find(lambda n: n.tag == 'img'):
            src, alt = img.attrs.get('src', ''), img.attrs.get('alt', '')
            if 'local--files/fragment:level-0-7-' not in src or src in image_map: continue
            name = str(len(images) + 1) + '.jpg'
            local = 'images/' + name
            if not (OUT / local).exists(): (OUT / local).write_bytes(fetch(src))
            image_map[src] = '../' + local
            images.append({'alt': alt, 'source': src, 'file': local})

    def render(n):
        if isinstance(n, str): return escape(n)
        cls = n.attrs.get('class', '')
        if n.tag in {'script','style','iframe','input','button','form','svg','link'}: return ''
        if 'display' in n.attrs.get('style', '') and 'none' in n.attrs['style'] and '翻译者须知' in n.text(): return ''
        if any(k in cls.split() for k in ['page-rate-widget-box','info-container','rate-box-with-credit-button']): return ''
        if 'sd-container' in cls.split():
            known = bool(n.find(lambda c: 'class-2' in c.attrs.get('class', '').split()))
            return '<blockquote><b>生存難度：等級 2</b><br>不安全 · 穩定 · 少量實體</blockquote>' if known else '<blockquote><b>生存難度：等待分級</b><br>安全性未知 · 不穩定 · 未探明實體存在</blockquote>'
        if 'collapsible-block' in cls.split() and '@import' in n.text(): return ''
        if cls in {'collapsible-block-folded','collapsible-block-unfolded-link'}: return ''
        if n.tag == 'img':
            src = image_map.get(n.attrs.get('src', ''))
            return f'<img src="{src}" alt="{escape(n.attrs.get("alt", ""))}">' if src else ''
        children = ''.join(render(c) for c in n.children)
        if n.tag == 'a':
            href = n.attrs.get('href', '')
            if href.startswith('javascript:'): return '' if n.text().strip() in {'X', 'close'} else children
            if href.startswith('/'): href = 'https://backrooms-wiki-cn.wikidot.com' + href
            return f'<a href="{escape(href, quote=True)}" target="_blank" rel="noopener">{children}</a>'
        tag = n.tag if n.tag in {'p','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','strong','b','em','i','u','s','sup','sub','br','hr','table','thead','tbody','tr','td','th','pre','code'} else 'div'
        attr = f' id="{escape(n.attrs["id"], quote=True)}"' if 'id' in n.attrs else ''
        return f'<{tag}{attr}>' + children + ('' if tag in {'br','hr'} else f'</{tag}>')

    titles = {'discovery': 'M.E.G.：發現前哨站', 'records': 'N.T.G.：1972／1981 年完整檔案', 'verified': 'M.E.G.：調查結尾'}
    def save(slug, title, url, body):
        intro = f'<div class="source">Level 0.7「憶域」／T-Dragon；譯者 jiaoyanerlan2、KkKkK_1234、owl4513。<br>原文採 CC BY-SA 3.0；原圖授權見文末。此為遊戲本機閱讀副本，摺疊與年代分頁已全部展開。<br><a href="{url}" target="_blank" rel="noopener">查看來源</a></div>'
        html = f'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)}</title><style>{STYLE}</style><main>{intro}<h1>{escape(title)}</h1>{body}</main></html>'
        (OUT / 'archive' / (slug + '.html')).write_text(html, encoding='utf-8')

    manifest = {'source': BASE, 'author': 'T-Dragon', 'translators': ['jiaoyanerlan2','KkKkK_1234','owl4513'], 'license': 'CC BY-SA 3.0', 'pages': [], 'images': images}
    for slug, url, content, digest in pages:
        panels = content.find(lambda n: n.attrs.get('id', '').startswith('wiki-tab-'))
        labels = ['現代區','早期電氣區','華麗高廳區','中世紀區','羅馬區','埃及區','前人類時代理論']
        for i, panel in enumerate(panels):
            heading = Node('h2'); heading.children.append(labels[i]); panel.children.insert(0, heading)
        save(slug, titles[slug], url, render(content))
        manifest['pages'].append({'id': slug, 'title': titles[slug], 'url': url, 'sha256': digest, 'textLength': len(content.text()), 'file': 'archive/' + slug + '.html'})
        if slug == 'records':
            for i, panel in enumerate(panels):
                save('era-' + str(i), labels[i], url, render(panel))
                manifest['pages'].append({'id':'era-' + str(i),'title':labels[i],'file':'archive/era-' + str(i) + '.html'})
    (OUT / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'pages':len(pages),'eraPanels':7,'images':len(images),'files':len(manifest['pages'])}, ensure_ascii=False))

if __name__ == '__main__': main()
