"""One-shot patch (2026-09-24): money graph strip, soil temp card, Laya fast + Gemini smart strip,
someone-added-water banner, field view. Backup of the page before this: laptop/static/index_v9_before_views.html"""
import pathlib

p = pathlib.Path(__file__).resolve().parents[1] / "laptop" / "static" / "index.html"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


rep("--good:#0a8a0a; --bad:#c43333; --warn:#9a6a00;", "--good:#0a8a0a; --bad:#c43333; --warn:#9a6a00; --heat:#7646b8;")
rep(".shell{height:100dvh;display:grid;grid-template-columns:minmax(0,1fr) 404px}",
    ".shell{height:100dvh;display:grid;grid-template-columns:minmax(0,1fr) 404px}\n"
    ".left{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0;min-width:0}")

EXTRA_CSS = r"""
/* money graph strip under the stage */
.graph{display:grid;grid-template-columns:minmax(0,1fr) 212px;gap:22px;padding:14px 24px;background:var(--panel);border-top:1px solid var(--line);border-bottom:0}
.ghead{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:4px}
.ghead h3{margin:0;font:700 1.02rem/1 var(--f-display);letter-spacing:-.01em}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-2)}
.leg span{display:inline-flex;align-items:center;gap:6px}
.leg i{display:inline-block;width:18px;height:0;border-top:2px solid}
.leg .m i{border-color:var(--ai)} .leg .t i{border-color:var(--timer);border-top-style:dashed} .leg .h i{border-color:var(--heat)}
.leg em{font-style:normal;color:var(--muted)}
.ghead .seg{margin-left:auto;background:var(--wash)}
.ghead .seg button{height:26px;padding:0 10px;font-size:12.5px}
.chart{position:relative}
.chart svg{display:block;width:100%;height:188px;overflow:visible}
.chart .ax{font:500 11px var(--f-num);fill:var(--muted)}
.chart .lab{font:600 11.5px var(--f-body);fill:var(--ink-2)}
.chart .grid{stroke:rgba(14,22,33,.07)}
.chart .empty{font:500 13px var(--f-body);fill:var(--muted)}
.tip{position:absolute;top:0;z-index:4;pointer-events:none;background:var(--ink);color:#fff;border-radius:9px;padding:7px 10px;font-size:12.5px;line-height:1.45;white-space:nowrap;transform:translateX(-50%);opacity:0;transition:opacity .12s}
.tip b{font-family:var(--f-num);font-weight:600}
.tip .sw{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.cups{display:grid;align-content:center;gap:3px;border-left:1px solid var(--line);padding-left:20px}
.cups .big{font-size:2.6rem;letter-spacing:-.04em}
.cups .unit{font:700 1rem/1 var(--f-display);color:var(--ink)}
.cups .sub b{font-family:var(--f-num);font-weight:600}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--timer);background:rgba(196,80,31,.09);border-radius:6px;padding:2px 6px;justify-self:start}

/* fast + smart */
.brains{display:grid;gap:6px;margin:4px 0 14px}
.br{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 10px;border-radius:11px;background:var(--wash);font-size:13.5px;line-height:1.3;transition:background .4s}
.br > i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:17px;background:#fff;color:var(--ai)}
.br b{font-weight:700} .br span{color:var(--ink-2);font-size:12.5px}
.br .t{font:600 1.05rem/1 var(--f-num);color:var(--ai);text-align:right}
.br .t small{display:block;font:500 11px var(--f-body);color:var(--muted);margin-top:3px}
.br.fresh{background:var(--ai-wash)}
.br.off .t,.br.off > i{color:var(--muted)}

/* temperature card */
.nums .heat .big{color:var(--heat)}

/* someone-added-water banner */
.alert{position:absolute;left:50%;top:22px;z-index:5;transform:translate(-50%,-150%);opacity:0;display:grid;grid-template-columns:44px auto;gap:14px;align-items:center;padding:14px 22px 14px 14px;border-radius:16px;background:var(--ink);color:#fff;box-shadow:0 18px 40px rgba(14,22,33,.22);transition:transform .5s var(--ease),opacity .3s;max-width:min(560px,calc(100% - 32px))}
.alert.on{transform:translate(-50%,0);opacity:1}
.alert > i{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--ai);font-size:24px}
.alert b{display:block;font:700 1.3rem/1.15 var(--f-display);letter-spacing:-.01em}
.alert b .num{color:#9cc4f2}
.alert span{display:block;color:rgba(255,255,255,.84);font-size:14.5px;margin-top:3px}

/* view switch + field view */
.seg button .ph{font-size:14px;vertical-align:-2px;margin-right:3px}
.fieldview{position:absolute;inset:0;z-index:2;background:#e6dfcf;overflow:hidden}
.fieldview svg{position:absolute;inset:0;width:100%;height:100%}
#fieldZoom{transform-box:view-box;transition:transform 1.5s var(--ease)}
.fieldcap{position:absolute;top:22px;right:24px;z-index:3;max-width:320px;background:rgba(251,252,253,.95);border:1px solid var(--line);border-radius:14px;padding:13px 15px;font-size:13.5px;color:var(--ink-2)}
.fieldcap .est{margin-bottom:7px;color:var(--ink-2);background:var(--wash)}
.fieldcap b{color:var(--ink)}
.fieldcap .fk{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:12.5px}
.fieldcap .fk .ramp{width:80px;--r0:#c8a878;--r1:#5a8fc8;--r2:#1f5fb0}
"""
rep("@media (max-width:1100px)", EXTRA_CSS + "\n@media (max-width:1100px)")
rep("@media (max-width:1100px){.shell{grid-template-columns:1fr;height:auto} .stage{height:62dvh;min-height:420px}",
    "@media (max-width:1100px){.shell{grid-template-columns:1fr;height:auto} .left{height:auto} .stage{height:62dvh;min-height:420px}")
rep("@media (max-width:560px){",
    "@media (max-width:760px){.graph{grid-template-columns:1fr;padding:14px 16px}.cups{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:12px}"
    ".ghead .seg{margin-left:0}.fieldcap{left:16px;right:16px;top:auto;bottom:118px;max-width:none}}\n@media (max-width:560px){")

rep('''  <main class="stage" aria-label="3D view of the pot">''', '''  <div class="left">
  <main class="stage" id="stage" aria-label="3D view of the pot">''')
rep('''    <div class="lens">
      <div class="seg" role="group" aria-label="Color the soil by">''', '''    <div class="alert" id="alert" role="status" aria-live="assertive"><i class="ph-fill ph-drop"></i><div><b id="alertT"></b><span id="alertS"></span></div></div>
    <div class="fieldview" id="fieldView" hidden></div>
    <div class="lens">
      <div class="seg" role="group" aria-label="View">
        <button class="on" data-view="pot"><i class="ph ph-cube"></i>This box</button><button data-view="field"><i class="ph ph-squares-four"></i>A whole field</button>
      </div>
      <div class="seg" id="lensSeg" role="group" aria-label="Color the soil by">''')
rep('''      <small><span>dry</span><span class="ramp" id="ramp"></span>''', '''      <small id="lensKey"><span>dry</span><span class="ramp" id="ramp"></span>''')
rep('''    <div class="tag" id="tagA" hidden></div><div class="tag" id="tagB" hidden></div>
  </main>
''', '''    <div class="tag" id="tagA" hidden></div><div class="tag" id="tagB" hidden></div>
  </main>
  <section class="graph" aria-label="Soil over time and water saved">
    <div>
      <div class="ghead">
        <h3>Soil over time</h3>
        <div class="leg"><span class="m"><i></i>Moisture <em>measured</em></span><span class="t"><i></i>If a timer watered <em>estimated</em></span><span class="h"><i></i>Soil temp <em>measured</em></span></div>
        <div class="seg" role="group" aria-label="Time window"><button data-win="1">1 h</button><button data-win="6">6 h</button><button class="on" data-win="24">24 h</button><button data-win="0">All</button></div>
      </div>
      <div class="chart" id="chart"><svg id="chartSvg" role="img" aria-label="Soil moisture and temperature over time"></svg><div class="tip" id="tip"></div></div>
    </div>
    <div class="cups">
      <span class="k" id="cupsK">Water saved vs a timer</span>
      <span><span class="big num" id="cups">–</span> <span class="unit" id="cupsU">cups</span></span>
      <span class="sub" id="cupsSub">&nbsp;</span>
      <span class="est">Timer is estimated</span>
      <span class="sub muted" id="cupsHow"></span>
    </div>
  </section>
  </div>
''')
rep('''      <p class="who" id="by">&nbsp;</p>''', '''      <p class="who" id="by">&nbsp;</p>
      <div class="brains" id="brains">
        <div class="br fast" id="brFast"><i class="ph-fill ph-lightning"></i><div><b id="fastPick">Laya, the fast call</b><br><span id="fastSub">our small model, trained on 6 years of Miami weather</span></div><span class="t num" id="fastT">–</span></div>
        <div class="br smart" id="brSmart"><i class="ph ph-users-three"></i><div><b id="smartH">Gemini team explains</b><br><span id="smartSub">weather, soil, memory, planner, critic</span></div><span class="t num" id="smartT">–</span></div>
      </div>''')
rep('''      <button class="link pinch" id="pinchBtn" hidden><i class="ph ph-hand-pinch"></i><span>Pinch the tube (test)</span></button>''',
    '''      <button class="link pinch" id="pinchBtn" hidden><i class="ph ph-hand-pinch"></i><span>Pinch the tube (test)</span></button>
      <button class="link pinch" id="handBtn" hidden><i class="ph ph-drop-half"></i><span>Pour a cup in by hand (test)</span></button>''')
rep('''      <div><span class="k">Water saved vs timer</span><span class="big" id="saved">–</span><span class="sub" id="savedSub">&nbsp;</span></div>''',
    '''      <div class="heat"><span class="k">Soil temperature</span><span class="big num" id="tA">–</span><span class="sub" id="tSub">&nbsp;</span></div>''')
rep('''<script type="module" src="scene.js"></script>''', '''<script src="views.js"></script>
<script type="module" src="scene.js"></script>''')

# old inline code that fed the removed "water saved" card and the temp-in-moisture line
rep('''  $('sA').textContent = L.temp_c != null ? `soil ${L.temp_c.toFixed(1)}°C, healthy ${S.config.dry}-${S.config.wet}%` : ' ';''',
    '''  $('sA').textContent = `healthy ${S.config.dry}-${S.config.wet}%`;
  $('tSub').textContent = f.temp_c_now != null ? `outside air ${(+f.temp_c_now).toFixed(1)}°C, forecast` : 'steel probe in the soil';''')
rep('''  const [dec, rep] = await Promise.all([j('/api/decisions'), j('/api/report')]);''', '''  const dec = await j('/api/decisions');''')
rep('''  $('saved').textContent = rep.water_saved_pct != null ? `${rep.water_saved_pct}%` : 'Too early';
  $('saved').classList.toggle('num', rep.water_saved_pct != null);
  $('saved').style.color = rep.water_saved_pct == null ? 'var(--muted)' : rep.water_saved_pct >= 0 ? 'var(--good)' : 'var(--bad)';
  $('savedSub').innerHTML = `AI <b class="num" style="color:var(--ai)">${rep.ai_pot_ml} ml</b> vs timer <b class="num" style="color:var(--timer)">${rep.timer_pot_ml} ml</b>`
    + (rep.ai_pot_demo_ml ? `<br>${rep.ai_pot_demo_ml} ml of the AI's was test pours and demos` : '');
''', '')
rep('''  $('pA').textContent = L.a != null ? L.a.toFixed(1) + '%' : '–';''', '''  $('pA').textContent = L.a != null ? L.a.toFixed(1) + '%' : '–';
  $('tA').textContent = L.temp != null ? L.temp.toFixed(1) + '°C' : '–';''')

p.write_text(s, encoding="utf-8")
print("patched", p)
