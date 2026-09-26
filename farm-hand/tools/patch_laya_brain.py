"""Wire the trained Laya model in as Farm Hand's fast decider.
- config: LAYA_URL, USE_LAYA
- brain: get_fast_decision() tool (planner + critic see Laya's pick), laya_decide() for when the Gemini team is off/slow/failed
- order: Gemini team (with Laya's pick as input) -> Laya alone -> plain rules. Safety guards still run on every pour.
- dashboard: a 'Fast decider (Laya)' step in the agent team list."""
from pathlib import Path
H = Path(__file__).resolve().parent.parent

def patch(rel, reps):
    p = H / rel; s = p.read_text(encoding="utf-8")
    for a, b in reps:
        assert s.count(a) == 1, (rel, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch("laptop/config.py", [
    ('USE_LLM = env("USE_LLM", "auto")',
     '# Laya: our fine-tuned decision model (laya/serve_decider.py). One call, ~20 ms, trained on 2019-24 Miami weather.\n'
     'LAYA_URL = env("LAYA_URL", "http://127.0.0.1:8091")\n'
     'USE_LAYA = env("USE_LAYA", 1, int)\n'
     'USE_LLM = env("USE_LLM", "auto")'),
])

patch("laptop/brain.py", [
    ("# ---------- rule brain (no AI) ----------",
     '''# ---------- Laya: the fast decider (our fine-tuned model) ----------
# Trained on the field scale: wilting 20%, stress line 42.5%, field capacity 65%. The box's healthy band
# (DRY_PCT..WET_PCT) is mapped onto stress line..field capacity so the model sees the same picture.

def _laya_state():
    soil = get_soil("A")
    if "error" in soil:
        return None, soil["error"]
    pct = soil["moisture_pct"]
    fc, dr = feeds.forecast(), feeds.drought()
    outdoors = bool(config.OUTDOORS)
    lt = time.localtime()
    return {
        "soil_moisture_pct": round(42.5 + (pct - config.DRY_PCT) * (65 - 42.5) / (config.WET_PCT - config.DRY_PCT), 1),
        "stress_line_pct": 42.5,
        "air_temp_c": fc.get("temp_c_now", soil.get("soil_temp_c")),
        "hour": lt.tm_hour, "month": time.strftime("%B", lt),
        "rain_forecast_next_24h_mm": fc.get("rain_mm_next_24h", 0.0) if outdoors else 0.0,   # indoors: rain can't reach the pot
        "rain_chance_next_24h_pct": fc.get("max_rain_chance_next_24h", 0) if outdoors else 0,
        "crop_water_use_last_24h_mm": round((fc.get("et0_mm_next_24h") or 0) * 1.05, 2),
        "hours_since_real_rain": 48 if (fc.get("hours_until_real_rain") is None) else 0,
        "county_drought": f"{dr.get('level', '')} {dr.get('level_name', '')}".strip() or "unknown",
    }, pct


def get_fast_decision() -> dict:
    """Laya, Farm Hand's own small decision model (fine-tuned on 6 years of real Miami weather), picks water / wait_rain / wait_moist in one fast call, with probabilities. Use it as a strong second opinion."""
    if not config.USE_LAYA:
        return {"error": "Laya is switched off"}
    state, pct = _laya_state()
    if state is None:
        return {"error": pct}
    try:
        import requests
        r = requests.post(config.LAYA_URL + "/decide", json={"state": state}, timeout=3).json()
    except Exception as e:
        return {"error": f"Laya not reachable: {type(e).__name__}"}
    log_act("laya", f"{r['choice']} {max(r['probabilities'].values()):.0%} ({r['ms']} ms)")
    return {"pick": r["choice"], "probabilities": r["probabilities"], "ms": r["ms"], "soil_pct": pct}


def laya_decide():
    """Laya alone decides (Gemini team off, slow or failed). Same safety checks as the rules, then the guards."""
    mem = get_memory()
    if mem["failed_pours_recently"] >= 2:
        return None
    d = get_fast_decision()
    if "error" in d:
        return None
    pct, sure = d["soil_pct"], max(d["probabilities"].values())
    if d["pick"] != "water":
        why = "rain is coming that will cover it" if d["pick"] == "wait_rain" else "the soil still has enough water"
        return "wait", 0, f"WAIT: soil is {pct:.0f}% and {why} (Laya, {sure:.0%} sure)."
    secs = max(1.0, (config.TARGET_PCT - pct) / pct_per_s())
    r = water_pot(secs, f"Laya: water ({sure:.0%})")
    if r["watered"]:
        return "water", r["seconds"], f"WATER: soil is {pct:.0f}% and no rain will cover it. Watering {r['seconds']:.0f} s (Laya, {sure:.0%} sure)."
    return "wait", 0, f"WAIT: Laya said water, but the safety rules said no ({r['refused_because']})."


# ---------- rule brain (no AI) ----------'''),
    ('name="planner_agent", model=m, output_key="planner_text", tools=[propose_plan],',
     'name="planner_agent", model=m, output_key="planner_text", tools=[get_fast_decision, propose_plan],'),
    ('                     "Call propose_plan exactly once. The farmer_sentence is one plain sentence a 13-year-old understands."))',
     '                     "- First call get_fast_decision: Laya, our model trained on 6 years of Miami weather, gives its pick. "\n'
     '                     "Follow it unless the data above clearly says otherwise, and if you overrule it, say why in the reason.\\n"\n'
     '                     "Call propose_plan exactly once. The farmer_sentence is one plain sentence a 13-year-old understands."))'),
    ('        if brain == "rules":\n            action, secs, sentence = rule_decide()\n        else:',
     '        if brain == "rules":\n            got = laya_decide()\n            if got:\n                brain = "laya (fast decider)"\n                action, secs, sentence = got\n            else:\n                action, secs, sentence = rule_decide()\n        else:'),
    ('''        print("[brain] AI team failed, rules take over:", repr(e)[:300])
        log_act("executor", "AI failed -> rules")
        brain = "rules (AI failed)"
        _last_action.clear()
        action, secs, sentence = rule_decide()''',
     '''        print("[brain] AI team failed, Laya then rules take over:", repr(e)[:300])
        _last_action.clear()
        got = laya_decide()
        if got:
            log_act("executor", "AI slow/failed -> Laya decided")
            brain = "laya (AI failed)"
            action, secs, sentence = got
        else:
            log_act("executor", "AI failed -> rules")
            brain = "rules (AI failed)"
            action, secs, sentence = rule_decide()'''),
])

patch("laptop/static/index.html", [
    ('''          <li data-k="predictor"><i class="ph ph-trend-up"></i><span>Dry-time model</span><span class="w" id="w-predictor"></span></li>''',
     '''          <li data-k="predictor"><i class="ph ph-trend-up"></i><span>Dry-time model</span><span class="w" id="w-predictor"></span></li>
          <li data-k="laya"><i class="ph ph-lightning-a"></i><span>Fast decider (Laya)</span><span class="w" id="w-laya"></span></li>'''),
    ("target_agent:'Target'}", "target_agent:'Target', laya:'Laya'}"),
    ("${x.brain.startsWith('gemini') ? 'Gemini agent team' : x.brain === 'target run' ? 'Target run' : 'Rule brain'}",
     "${x.brain.startsWith('gemini') ? 'Gemini agent team' : x.brain === 'target run' ? 'Target run' : x.brain.startsWith('laya') ? 'Laya fast decider' : 'Rule brain'}"),
])
print("ok")
