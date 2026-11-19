"""
按需子集化字体：扫描页面与脚本中实际用到的字符，向 Google Fonts 请求只含这些字形的
woff2，并以 base64 内嵌到 src/fonts.css。这样页面离线可用、导出视频时字体也完全一致。
字体均为 SIL Open Font License。
运行: python3 tools/fetch_fonts.py
"""
import base64, os, re, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

def collect():
    chars = set()
    for f in ['index.html', 'src/scenes.js', 'src/main.js', 'src/shapes.js']:
        chars |= set(open(os.path.join(ROOT, f), encoding='utf-8').read())
    chars |= set(chr(c) for c in range(0x20, 0x7f))
    chars |= set('，。、；：？！“”‘’（）《》…—·×≤≪≈∞⋮→↑−')
    return ''.join(sorted(c for c in chars if c >= ' ' and c not in '\n\r\t'))

FAMILIES = [
    # (别名, Google 字体族, 轴规格, 字符集)
    ('GSerif', 'Noto Serif SC', 'wght@600;900', 'all'),
    ('GSans', 'Noto Sans SC', 'wght@400;500', 'all'),
    ('GMath', 'Noto Serif Display', 'ital,wght@0,500;0,600;1,500', 'latin'),
    ('GMono', 'JetBrains Mono', 'wght@400;500', 'latin'),
]

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def main():
    allc = collect()
    latin = ''.join(sorted(set(chr(c) for c in range(0x20, 0x7f)) | set('×≤≪≈…−·’')))
    out = ['/* 由 tools/fetch_fonts.py 生成：Noto Serif SC / Noto Sans SC / Noto Serif Display / JetBrains Mono 的子集（SIL OFL） */\n']
    total = 0
    for alias, fam, axes, cs in FAMILIES:
        text = allc if cs == 'all' else latin
        q = urllib.parse.urlencode({'family': f'{fam}:{axes}', 'text': text, 'display': 'block'}, safe=':;@,')
        css = fetch('https://fonts.googleapis.com/css2?' + q).decode()
        # 可变字体会对多个字重返回同一个文件：合并为一个字重区间
        faces = {}
        for block in re.findall(r'@font-face\s*{[^}]*}', css):
            style = re.search(r'font-style:\s*(\w+)', block).group(1)
            weight = int(re.search(r'font-weight:\s*(\d+)', block).group(1))
            url = re.search(r'url\((https://[^)]+)\)', block).group(1)
            faces.setdefault((style, url), []).append(weight)
        for (style, url), ws in faces.items():
            data = fetch(url)
            total += len(data)
            b64 = base64.b64encode(data).decode()
            wr = f'{min(ws)} {max(ws)}' if len(ws) > 1 else str(ws[0])
            out.append(f"@font-face{{font-family:'{alias}';font-style:{style};font-weight:{wr};font-display:block;"
                       f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}\n")
            print(alias, style, wr, len(data), 'bytes')
    open(os.path.join(ROOT, 'src', 'fonts.css'), 'w').write(''.join(out))
    print('total', total, 'bytes;', len(allc), 'chars')

main()
