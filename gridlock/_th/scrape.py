import re, glob, json, subprocess, html, os, time
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
out=[]
for y in (2024,2025,2026):
    for p in (1,2,3,4):
        s=open(f"g_{y}_{p}.html",encoding="utf-8").read()
        for blk in re.split(r'gallery-item" data-software-id', s)[1:]:
            if 'class="winner"' not in blk: continue
            m=re.search(r'href="(https://devpost.com/software/[^"]+)"',blk)
            n=re.search(r'<h5>\s*(.*?)\s*</h5>',blk,re.S)
            out.append({"year":y,"url":m.group(1),"name":html.unescape(n.group(1).strip())})
print(len(out))
for r in out:
    slug=r["url"].rsplit("/",1)[1]
    fn=f"p_{slug}.html"
    if not os.path.exists(fn) or os.path.getsize(fn)<5000:
        subprocess.run(["curl","-sL","-A",UA,"-H","Accept: text/html",r["url"],"-o",fn])
    t=open(fn,encoding="utf-8",errors="ignore").read()
    tag=re.search(r'<p class="large"[^>]*>\s*(.*?)\s*</p>',t,re.S)
    r["tagline"]=html.unescape(re.sub(r'<[^>]+>','',tag.group(1))).strip() if tag else ""
    # prizes
    prizes=[]
    for li in re.findall(r'<span class="winner label[^"]*">Winner</span>(.*?)</li>',t,re.S):
        prizes.append(html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',li))).strip())
    r["prizes"]=prizes
    gh=sorted(set(re.findall(r'href="(https?://(?:www\.)?github\.com/[^"#?]+)"',t)))
    r["github"]=[g for g in gh if g.rstrip('/').count('/')>=4 and 'devpost' not in g.lower()]
    sub=re.search(r'Submitted to\s*</h\d>',t)
    r["ok"]=len(t)>20000
json.dump(out,open("winners.json","w",encoding="utf-8"),indent=1,ensure_ascii=False)
from collections import Counter
print(Counter(r["year"] for r in out))
print(sum(1 for r in out if not r["prizes"]), "no prize parsed")
