from pathlib import Path
p = Path(__file__).parent / 'index.html'; s = p.read_text(encoding='utf-8')
reps = [
('.muted{color:var(--muted)}\n',
 '''.muted{color:var(--muted)}
.call .verdict.good{color:var(--good)}
.tgt{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.tgt .k{margin-right:auto}
.stepper{display:inline-flex;align-items:center;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--wash)}
.stepper button{width:34px;height:100%;display:grid;place-items:center;color:var(--ink-2);font-size:15px}
.stepper button:hover{color:var(--ink)}
.stepper b{min-width:52px;text-align:center;font-size:16px}
.go{height:38px;padding:0 16px;border-radius:10px;background:var(--ink);color:#fff;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:7px;transition:transform .12s var(--ease)}
.go:active:not(:disabled){transform:scale(.97)}
.pulses{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pulses:empty{display:none}
.pulses li{font-size:12.5px;padding:4px 9px;border-radius:99px;background:var(--ai-wash);color:var(--ai);font-weight:600}
.pulses li.bad{background:rgba(196,51,51,.1);color:var(--bad)}
.hud{position:absolute;top:22px;right:24px;z-index:3;display:grid;justify-items:end;gap:2px;text-align:right}
.hud .lbl{font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.hud .now{font:600 3.4rem/1 var(--f-num);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.hud .of{font-size:14px;color:var(--ink-2)}
.hud .track{position:relative;width:220px;height:8px;border-radius:9px;background:rgba(14,22,33,.08);margin-top:8px}
.hud .track i{position:absolute;left:0;top:0;bottom:0;border-radius:9px;background:var(--ai);transition:width .5s var(--ease)}
.hud .track s{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink);border-radius:2px}
.hud.good .now{color:var(--good)} .hud.good .track i{background:var(--good)}
.hud.bad .now{color:var(--bad)} .hud.bad .track i{background:var(--bad)}
.link.pinch{color:var(--muted);font-weight:500;margin-top:6px}
'''),
('@media (max-width:560px){section{padding:18px 16px}',
 '@media (max-width:560px){.hud{top:auto;bottom:64px;right:16px}.hud .now{font-size:2.4rem}.hud .track{width:150px}section{padding:18px 16px}'),
('    <div class="front" id="front" hidden></div>',
 '''    <div class="hud" id="hud" hidden><span class="lbl" id="hudLbl">Target</span><span class="now" id="hudNow">–</span><span class="of" id="hudOf"></span><span class="track"><i id="hudBar"></i><s id="hudMark"></s></span></div>
    <div class="front" id="front" hidden></div>'''),
('''        <button class="link stop" id="stopBtn"><i class="ph-bold ph-stop"></i>Stop pump</button>
      </div>''',
 '''        <button class="link stop" id="stopBtn"><i class="ph-bold ph-stop"></i>Stop pump</button>
      </div>
      <div class="tgt">
        <span class="k">Hit a target</span>
        <span class="stepper"><button id="tMinus" aria-label="Lower target"><i class="ph-bold ph-minus"></i></button><b class="num" id="tVal">55%</b><button id="tPlus" aria-label="Raise target"><i class="ph-bold ph-plus"></i></button></span>
        <button class="go" id="goBtn"><i class="ph-bold ph-crosshair"></i>Go</button>
      </div>
      <ol class="pulses" id="pulses"></ol>
      <button class="link pinch" id="pinchBtn" hidden><i class="ph ph-hand-pinch"></i><span>Pinch the tube (test)</span></button>'''),
('''          <li data-k="soak"><i class="ph ph-waves"></i><span>Pour detector</span><span class="w" id="w-soak"></span></li>''',
 '''          <li data-k="soak"><i class="ph ph-waves"></i><span>Pour detector</span><span class="w" id="w-soak"></span></li>
          <li data-k="target_agent"><i class="ph ph-crosshair"></i><span>Target controller</span><span class="w" id="w-target_agent"></span></li>'''),
("executor:'Pump', farm_helper:'Chat'}", "executor:'Pump', farm_helper:'Chat', target_agent:'Target'}"),
("let S = null, tab = 'team';", "let S = null, tab = 'team', tgt = 55, showT = false;"),
("  if (L.pumping !== 'none') { w.classList.remove('idle'); $('workTxt').textContent = 'Pump running'; }",
 "  drawTarget(L);\n  if (L.pumping !== 'none') { w.classList.remove('idle'); $('workTxt').textContent = 'Pump running'; }"),
("  if (dec.length && !$('runBtn').disabled) {", "  if (dec.length && !$('runBtn').disabled && !showT) {"),
("    $('by').textContent = `${x.brain.startsWith('gemini') ? 'Gemini agent team' : 'Rule brain'}, ${clock(x.ts)}`;",
 "    const mins = Math.round((Date.now() / 1000 - x.ts) / 60);\n"
 "    $('by').textContent = `${x.brain.startsWith('gemini') ? 'Gemini agent team' : x.brain === 'target run' ? 'Target run' : 'Rule brain'}, ${clock(x.ts)}${mins >= 5 ? `, ${mins >= 90 ? Math.round(mins / 60) + ' h' : mins + ' min'} ago` : ''}`;"),
("x.sentence.replace(/^(WATER|WAIT):\\s*/, '')", "x.sentence.replace(/^(WATER|WAIT|TARGET):\\s*/, '')"),
("$('stopBtn').onclick = () => fetch('/api/stop', {method: 'POST'});",
 r"""$('stopBtn').onclick = () => fetch('/api/stop', {method: 'POST'});
const setT = v => { tgt = Math.max(36, Math.min(68, v)); $('tVal').textContent = tgt + '%'; };
$('tMinus').onclick = () => setT(tgt - 1); $('tPlus').onclick = () => setT(tgt + 1);
$('goBtn').onclick = async () => { const r = await j('/api/target', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pct: tgt})});
  if (!r.ok) { $('verdict').textContent = 'Can\'t start'; $('verdict').className = 'verdict bad'; $('reason').textContent = r.why + '.'; } };
$('pinchBtn').onclick = () => j('/api/demo/pinch', {method: 'POST'});
const DONE = {locked:1, over:1, fault:1, blocked:1, stopped:1, short:1};
function drawTarget(L) {
  const T = L.target || {}, ph = T.phase || 'idle', end = DONE[ph], recent = end && Date.now() / 1000 - (T.t_end || 0) < 240;
  $('pinchBtn').hidden = !L.fake; $('pinchBtn').lastChild.textContent = L.pinched ? 'Tube pinched: tap to release' : 'Pinch the tube (test)';
  $('pinchBtn').style.color = L.pinched ? 'var(--bad)' : '';
  showT = ph !== 'idle' && (!end || recent);
  $('goBtn').disabled = ph !== 'idle' && !end;
  $('hud').hidden = !showT; if (!showT) { $('pulses').innerHTML = ''; return; }
  const now = end ? T.now : (L.a ?? T.now), good = ph === 'locked', bad = ph === 'fault' || ph === 'blocked';
  $('hud').className = 'hud' + (good ? ' good' : bad ? ' bad' : '');
  $('hudLbl').textContent = good ? 'Target hit' : bad ? 'Stopped' : end ? 'Target run over' : 'Aiming for target';
  $('hudNow').textContent = now != null ? now.toFixed(1) + '%' : '–';
  $('hudOf').textContent = `target ${T.target}% ±${T.band}, started at ${T.start}%`;
  const pos = v => Math.max(0, Math.min(100, (v - T.start) / Math.max(1, T.target + T.band - T.start) * 100));
  $('hudBar').style.width = pos(now) + '%'; $('hudMark').style.left = pos(T.target) + '%';
  const P = T.pulses || [];
  $('pulses').innerHTML = P.map((p, i) => `<li class="num${ph === 'fault' && i === P.length - 1 ? ' bad' : ''}">${p.s} s ${p.rise >= 0 ? '+' : ''}${p.rise}%</li>`).join('');
  $('verdict').className = 'verdict ' + (good ? 'good' : bad ? 'bad' : 'water');
  $('verdict').textContent = good ? `Hit ${T.now}%` : ph === 'fault' ? 'Water isn\'t arriving' : ph === 'blocked' ? 'Blocked' : end ? 'Target run over' : `Aiming ${T.target}%`;
  $('reason').textContent = T.msg || '';
  $('by').textContent = end ? `${P.length} pulse${P.length === 1 ? '' : 's'}, ${T.secs} s of pumping, ${T.ml} ml, ${T.took_s} s total. Learned ${T.rate} % per second.`
    : `Pulse ${P.length + (ph === 'settling' ? 0 : 1)}, learned ${(+T.rate).toFixed(2)} % per second${ph === 'settling' ? '. Waiting for the water to reach the probe.' : ''}`;
}"""),
]
for a, b in reps:
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)
p.write_text(s, encoding='utf-8'); print('ok')
