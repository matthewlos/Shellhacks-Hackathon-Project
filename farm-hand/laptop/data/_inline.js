const $ = id => document.getElementById(id);
const j = async (u, o) => (await fetch(u, o)).json();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clock = ts => new Date(ts * 1000).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}).replace(/\s(?=[AP]M)/, ' ');
const NAMES = {weather_agent:'Weather', soil_agent:'Soil', memory_agent:'Memory', planner_agent:'Planner', critic_agent:'Critic', guards:'Safety', executor:'Pump', farm_helper:'Chat'};
window.LIVE = {busy:{}, soak:{}}; window.LENS = 'natural';
let S = null, tab = 'team';

document.querySelectorAll('[data-lens]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-lens]').forEach(x => x.classList.toggle('on', x === b)); window.LENS = b.dataset.lens; ramp(); });
function ramp() { const r = {natural:['#c8a878','#7a5534','#2a1c12'], moisture:['#c8a878','#5a8fc8','#1f5fb0'], temp:['#1f64b8','#c9b89a','#c4501f']}[window.LENS];
  ['--r0','--r1','--r2'].forEach((k, i) => $('ramp').style.setProperty(k, r[i])); }
ramp();
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  ['team','pours','ask'].forEach(t => $('pane-' + t).hidden = t !== tab); slow(); });

async function fast() {
  let L; try { L = await j('/api/live'); } catch (e) { return; }
  window.LIVE = L;
  $('pA').textContent = L.a != null ? L.a.toFixed(1) + '%' : '–';
  $('gA').style.transform = `scaleX(${Math.max(0, Math.min(1, (L.a ?? 0) / 100))})`;
  if (L.cfg) { $('okBand').style.left = L.cfg.dry + '%'; $('okBand').style.width = (L.cfg.wet - L.cfg.dry) + '%'; }
  const busy = Object.entries(L.busy || {}), w = $('working');
  if (L.pumping !== 'none') { w.classList.remove('idle'); $('workTxt').textContent = 'Pump running'; }
  else if (busy.length) { const [k, x] = busy[busy.length - 1]; w.classList.remove('idle'); $('workTxt').textContent = `${NAMES[k] || k}: ${x}`; }
  else if (L.soak?.phase === 'soaking') { w.classList.remove('idle'); $('workTxt').textContent = `Soaking in, ${L.soak.before?.toFixed(1)}% to ${L.soak.now?.toFixed(1)}%`; }
  else w.classList.add('idle');
  document.querySelectorAll('.steps li[data-k]').forEach(el => {
    const k = el.dataset.k, what = (L.busy || {})[k];
    let on = !!what; if (k === 'executor') on = on || L.pumping !== 'none'; if (k === 'soak') on = L.soak?.phase === 'soaking';
    el.classList.toggle('on', on); el.classList.toggle('bad', k === 'guards' && /^REFUSED/.test(what || '')); el.classList.toggle('warn', k === 'critic_agent' && /^sent back/.test(what || ''));
    const ww = $('w-' + k); if (!ww) return;
    if (what) ww.textContent = what;
    if (k === 'executor') ww.textContent = L.pumping !== 'none' ? 'running' : (what || '');
    if (k === 'soak') ww.textContent = L.soak?.phase === 'soaking' ? `${L.soak.before?.toFixed(1)} to ${L.soak.now?.toFixed(1)}%` : (L.soak?.last ? `last +${L.soak.last.rise_pct}%` : '');
  });
}

async function slow() {
  try { S = await j('/api/state'); } catch (e) { $('reason').textContent = 'Can\'t reach the Farm Hand server.'; return; }
  const d = S.drought || {}, f = S.forecast || {}, p = S.prediction || {}, L = S.latest || {};
  $('subline').textContent = S.fake ? 'Running on test data from the simulated board.' : S.online ? 'An AI agent team waters this pot. A timer is the thing to beat.' : 'The board is offline. Check the USB cable.';
  $('sA').textContent = L.temp_c != null ? `soil ${L.temp_c.toFixed(1)}°C, healthy ${S.config.dry}-${S.config.wet}%` : ' ';
  $('dry').textContent = p.settling ? 'measuring' : p.hours_until_dry != null ? (p.hours_until_dry < .05 ? 'now' : p.hours_until_dry >= 48 ? '2+ days' : `${p.hours_until_dry.toFixed(1)} h`) : '–';
  $('rain').textContent = f.rain_mm_next_24h != null ? `${f.rain_mm_next_24h} mm` : '–';
  $('rainD').textContent = f.max_rain_chance_next_24h != null ? `up to ${f.max_rain_chance_next_24h}% chance${S.config.outdoors ? '' : ', pot is indoors'}` : '';
  $('et0').textContent = f.et0_mm_next_24h != null ? `${f.et0_mm_next_24h} mm` : '–';
  $('drV').textContent = d.pct_in_D1_or_worse != null ? `${d.pct_in_D1_or_worse}%` : '–';
  $('drD').textContent = d.level ? `${(d.county || '').replace(' County', '')}, ${d.level} ${d.level_name}` : '';
  $('w-predictor').textContent = p.method === 'xgboost' ? 'XGBoost' : p.settling ? 're-measuring' : 'trend estimate';

  const [dec, rep] = await Promise.all([j('/api/decisions'), j('/api/report')]);
  if (dec.length && !$('runBtn').disabled) {
    const x = dec[0], water = x.action === 'water';
    $('verdict').textContent = water ? `Watering ${(+x.seconds).toFixed(0)} s` : 'Holding off';
    $('verdict').className = 'verdict' + (water ? ' water' : '');
    $('reason').textContent = x.sentence.replace(/^(WATER|WAIT):\s*/, '');
    $('by').textContent = `${x.brain.startsWith('gemini') ? 'Gemini agent team' : 'Rule brain'}, ${clock(x.ts)}`;
  }
  $('saved').textContent = rep.water_saved_pct != null ? `${rep.water_saved_pct}%` : 'Too early';
  $('saved').style.color = rep.water_saved_pct == null ? 'var(--muted)' : rep.water_saved_pct >= 0 ? 'var(--good)' : 'var(--bad)';
  $('savedSub').innerHTML = `AI <b class="num" style="color:var(--ai)">${rep.ai_pot_ml} ml</b> vs timer <b class="num" style="color:var(--timer)">${rep.timer_pot_ml} ml</b>`;

  if (tab === 'team') {
    const g = S.guards || [], bad = g.filter(x => !x.ok);
    $('w-guards').textContent = bad.length ? `${bad.length} blocking` : 'all clear';
    $('rules').innerHTML = bad.map(x => `<li><i class="ph-fill ph-x-circle n"></i>${esc(x.rule)}<small>${esc(x.detail)}</small></li>`).join('');
    const act = await j('/api/activity');
    $('log').innerHTML = act.slice(0, 12).map(a => { const w = a.what || '', c = /^REFUSED|failed/i.test(w) ? 'bad' : /^approved|pump A/.test(w) ? 'good' : /^sent back/.test(w) ? 'warn' : '';
      return `<li class="${c}"><span class="t num">${clock(a.ts).replace(/ ?[AP]M/, '')}</span><span><b>${esc(NAMES[a.agent] || a.agent)}</b> ${esc(w)}</span></li>`; }).join('');
  } else if (tab === 'pours') {
    $('learn').textContent = S.learned_pct_per_s ?? '–';
    const soaks = await j('/api/soaks');
    if (soaks.length) $('soaks').innerHTML = soaks.slice(0, 8).map(x => `<div class="soak"><b class="num" style="color:${x.ok ? 'var(--ai)' : 'var(--bad)'}">${x.ok ? '+' + x.rise_pct + '%' : 'Missed the soil'}</b> <span class="muted">${clock(x.ts)}</span>
      <div>${x.poured_s} s pour, ${x.before_pct}% to ${x.peak_pct}%${x.first_rise_s != null ? `, reached the probe in ${x.first_rise_s} s` : ''}${x.ok ? '' : '. ' + esc(x.note)}</div></div>`).join('');
  }
}

$('runBtn').onclick = async () => {
  const b = $('runBtn'); b.disabled = true; b.lastChild.textContent = 'Agents working';
  $('verdict').textContent = 'Thinking'; $('verdict').className = 'verdict'; $('reason').textContent = 'Reading the soil, the sky and its own memory.';
  try { await j('/api/check-now', {method: 'POST'}); } finally { b.disabled = false; b.lastChild.textContent = 'Run agents'; slow(); }
};
$('pourBtn').onclick = async () => { const r = await j('/api/pour', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({seconds: 5})});
  if (!r.watered) { $('verdict').textContent = 'Blocked'; $('verdict').className = 'verdict bad'; $('reason').textContent = 'Safety rules said no: ' + r.refused_because + '.'; } slow(); };
$('stopBtn').onclick = () => fetch('/api/stop', {method: 'POST'});
async function ask(q) { if (!q) return; $('reply').innerHTML = '<span class="muted">Gemini is checking its tools…</span>';
  const r = await j('/api/ask', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({q})}); $('reply').textContent = r.answer; }
$('askBtn').onclick = () => ask($('q').value);
$('q').onkeydown = e => { if (e.key === 'Enter') ask($('q').value); };
document.querySelectorAll('.sugg button').forEach(x => x.onclick = () => { $('q').value = x.textContent; ask(x.textContent); });
fast(); slow(); setInterval(fast, 400); setInterval(slow, 3000);
