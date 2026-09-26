"""The decision team. Every CHECK_EVERY_MIN minutes:

  1. GATHER (3 agents in parallel)
       weather_agent   rain forecast, drought level, watering rule
       soil_agent      Pot A + Pot B moisture, XGBoost "hours until dry"
       memory_agent    last 24 h: pours, what each pour actually did to the soil (pour detector), lessons learned
  2. DECIDE (loop, up to 3 rounds)
       planner_agent   proposes WATER n seconds or WAIT, with a reason and a farmer sentence
       critic_agent    checks the plan against the data. Approves, or sends it back with the problem.
  3. EXECUTE (code, not AI)
       only an approved WATER plan runs, and it still goes through guards() first
  4. LEARN (code, soak.py)
       the pour detector measures what the pour did; memory_agent reads it next cycle

Plus ask(): a chat agent that answers the farmer's questions from the same tools and the decision log.

Brains, in order of preference:
  gemini   GOOGLE_API_KEY set -> Google's Gemini API directly (use this at ShellHacks: Google tracks)
  gemini   RIGHTCODES_KEY_GEMINI set -> Gemini through the right.codes gateway (Dechante's testing lane)
  rules    no key, or the AI errored -> plain if-statements. The pots never go unwatered because WiFi died.
"""
import asyncio
import collections
import json
import os
import time

from google.adk.tools.tool_context import ToolContext

import config
import feeds
import predictor
import soak
import store

BOARD = None                                  # set by server.py
ACTIVITY = collections.deque(maxlen=200)      # what each agent is doing, for the live view
LAST = {"laya": None, "check": None}           # the dashboard's fast + smart strip: Laya's instant call, then how long the team took
LOW_MARGIN = 5                                # only water within 5 points of the dry line (no 1-second sips)
_last_action = {}


_loop = None


def _run(coro):
    """One long-lived event loop in a background thread, so the cached ADK runners never hit a closed loop."""
    global _loop
    import threading
    if _loop is None:
        _loop = asyncio.new_event_loop()
        threading.Thread(target=_loop.run_forever, daemon=True).start()
    fut = asyncio.run_coroutine_threadsafe(coro, _loop)
    try:
        return fut.result(timeout=config.AI_TIMEOUT_S)
    except BaseException:
        fut.cancel()            # stop the agents: no more paid calls, no orbs lighting up after the rules decided
        raise


def log_act(agent, what):
    ACTIVITY.append({"ts": time.time(), "agent": agent, "what": what})


def pct_per_s():
    return soak.learned_pct_per_s("A", default=1.2)


# ---------- tools (ADK reads the type hints + docstrings) ----------

def get_forecast() -> dict:
    """Rain forecast for the next 24 hours at the farm: rain chance, rain mm, hours until real rain, and ET0 (water the air pulls out of the soil). rain_reaches_pots says whether rain can even land on the pots."""
    return {**feeds.forecast(), "rain_reaches_pots": bool(config.OUTDOORS)}


def get_drought() -> dict:
    """This week's US Drought Monitor level for the county (e.g. D2 severe) and what % of the county is in drought."""
    return feeds.drought()


def get_watering_rule() -> dict:
    """Whether the local lawn-watering restriction allows watering right now. Farms follow different rules; treat this as advice."""
    return {**feeds.watering_day(), "enforced_by_code": bool(config.ENFORCE_WATERING_RULE)}


def get_soil(pot: str = "A") -> dict:
    """Live soil moisture % and soil temperature for pot 'A' (AI) or 'B' (timer), plus the predicted hours until it's dry."""
    b = BOARD.latest if BOARD else None
    if not b or time.time() - b["ts"] > 120:
        return {"error": "no fresh reading from the board in the last 2 minutes"}
    pot = "B" if str(pot).upper().startswith("B") else "A"
    return {"pot": pot, "moisture_pct": b["a_pct"] if pot == "A" else b["b_pct"], "soil_temp_c": b.get("temp_c"),
            "dry_below_pct": config.DRY_PCT, "wet_above_pct": config.WET_PCT, "target_pct": config.TARGET_PCT,
            "water_only_at_or_below_pct": config.DRY_PCT + LOW_MARGIN,
            "prediction": predictor.predict(pot)}


def get_memory() -> dict:
    """The last 24 hours: every pour on both pots, what each AI pour actually did to the soil (pour detector), and the learned % gained per second of pumping."""
    since = time.time() - 24 * 3600
    pours = store.pours_since(since)
    flow = config.load_cal()["flow_ml_per_s"]
    soaks = [dict(zip(("ts", "pot", "poured_s", "before_pct", "peak_pct", "rise_pct", "first_rise_s", "pct_per_s", "ok", "note"), r))
             for r in store.soaks(5)]
    for s in soaks:
        s["hours_ago"] = round((time.time() - s.pop("ts")) / 3600, 1)
        s["ok"] = bool(s["ok"])
    last = store.last_ai_pour_ts()
    return {
        "ai_pot_A": {"pours": sum(1 for p in pours if p[1] == "A"),
                     "ml": round(sum(p[2] for p in pours if p[1] == "A") / 1000 * flow["A"])},
        "timer_baseline": ({"what": "virtual timer, what a normal schedule would have poured",
                            "ml_last_24h": round(min(24 * 3600, time.time() - since) // config.TIMER_EVERY_S * config.TIMER_POUR_MS / 1000 * flow["A"])}
                           if config.ONE_POT else
                           {"what": "real pot B on a timer", "pours": sum(1 for p in pours if p[1] == "B"),
                            "ml": round(sum(p[2] for p in pours if p[1] == "B") / 1000 * flow["B"])}),
        "last_ai_pour_hours_ago": round((time.time() - last) / 3600, 1) if last else None,
        "recent_pour_results": soaks,
        "learned_pct_gain_per_second": pct_per_s(),
        "failed_pours_recently": sum(1 for s in soaks if not s["ok"]),
    }


def get_decision_log(n: int = 8) -> list:
    """The last n decisions the system made, newest first, with the sentence it gave the farmer."""
    return [{"hours_ago": round((time.time() - r[0]) / 3600, 2), "action": r[1], "seconds": r[2], "brain": r[3], "said": r[4]}
            for r in store.decisions(int(n))]


def propose_plan(action: str, seconds: float, reason: str, farmer_sentence: str, tool_context: ToolContext) -> dict:
    """Planner: propose the plan. action is 'water' or 'wait'. seconds = pump seconds (0 for wait). farmer_sentence starts with WATER: or WAIT:."""
    plan = {"action": action.lower().strip(), "seconds": float(seconds or 0), "reason": reason, "farmer_sentence": farmer_sentence}
    tool_context.state["plan"] = plan
    tool_context.state["approved"] = False
    log_act("planner_agent", f"proposed {plan['action']} {plan['seconds']:.0f}s")
    return {"saved": True, "plan": plan}


def approve_plan(note: str, tool_context: ToolContext) -> dict:
    """Critic: approve the planner's current plan. Ends the review."""
    tool_context.state["approved"] = True
    tool_context.state["critic_note"] = note
    tool_context.actions.escalate = True           # exits the LoopAgent
    log_act("critic_agent", "approved: " + note[:80])
    return {"approved": True}


def reject_plan(problem: str, tool_context: ToolContext) -> dict:
    """Critic: send the plan back to the planner with the exact problem to fix."""
    tool_context.state["approved"] = False
    tool_context.state["critic_feedback"] = problem
    log_act("critic_agent", "sent back: " + problem[:80])
    return {"approved": False, "problem": problem}


# ---------- hard rules (code, not AI) ----------

def guards(seconds, skip_gap=False):
    """Returns (ok, reason, seconds_allowed). The AI can't argue with this function.
    skip_gap=True only for a Hit-the-Target run a person started (target.py); every other rule still applies."""
    b = BOARD.latest if BOARD else None
    if not b or time.time() - b["ts"] > 120:
        return False, "board offline", 0
    if b["a_pct"] >= config.WET_PCT:
        return False, f"pot A already wet ({b['a_pct']}% >= {config.WET_PCT}%)", 0
    if soak.PAUSED and not skip_gap:
        return False, "a Hit-the-Target run is using the pump", 0
    gap = (time.time() - store.last_ai_pour_ts()) / 60
    if gap < config.AI_MIN_GAP_MIN and not skip_gap:
        return False, f"watered {gap:.0f} min ago, rule is {config.AI_MIN_GAP_MIN:.0f} min", 0
    today = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    ml_today = sum(r[2] / 1000 * config.load_cal()["flow_ml_per_s"]["A"] for r in store.pours_since(today) if r[1] == "A")
    if ml_today >= config.DAILY_MAX_ML:
        return False, f"daily cap hit ({ml_today:.0f} ml)", 0
    if config.ENFORCE_WATERING_RULE and not feeds.watering_day()["legal_now"]:
        return False, "not a legal watering time under local restrictions", 0
    if soak.live.get("phase") == "soaking":
        return False, "last pour is still soaking in", 0
    return True, "ok", max(1.0, min(float(seconds), config.POUR_CAP_S))


def guard_report():
    """Live status of every hard rule, for the dashboard. Same checks as guards(), one row each."""
    b = BOARD.latest if BOARD else None
    fresh = bool(b and time.time() - b["ts"] <= 120)
    gap = (time.time() - store.last_ai_pour_ts()) / 60 if store.last_ai_pour_ts() else None
    today = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    ml_today = sum(r[2] / 1000 * config.load_cal()["flow_ml_per_s"]["A"] for r in store.pours_since(today) if r[1] == "A")
    rows = [
        ("Board online", fresh, "reading " + (f"{time.time() - b['ts']:.0f} s ago" if b else "none yet")),
        ("Pot A not already wet", fresh and b["a_pct"] < config.WET_PCT, f"{b['a_pct']:.1f}% (limit {config.WET_PCT:.0f}%)" if b else "–"),
        ("Gap since last AI pour", gap is None or gap >= config.AI_MIN_GAP_MIN,
         (f"{gap:.0f} min" if gap is not None else "no pours yet") + f" (min {config.AI_MIN_GAP_MIN:.0f})"),
        ("Daily water cap", ml_today < config.DAILY_MAX_ML, f"{ml_today:.0f} / {config.DAILY_MAX_ML:.0f} ml"),
        ("Last pour finished soaking", soak.live.get("phase") != "soaking", soak.live.get("phase", "idle")),
        ("Pour length cap", True, f"{config.POUR_CAP_S} s (laptop) + 30 s (chip)"),
    ]
    if config.ENFORCE_WATERING_RULE:
        rows.append(("Legal watering time", feeds.watering_day()["legal_now"], feeds.watering_day()["rule"]))
    return [{"rule": r, "ok": bool(ok), "detail": d} for r, ok, d in rows]


def water_pot(seconds, reason, tag=None):
    ok, why, secs = guards(seconds)
    if not ok:
        _last_action.update(action="refused", seconds=0, why=why)
        log_act("guards", "REFUSED: " + why)
        return {"watered": False, "refused_because": why}
    BOARD.tag_next = tag
    BOARD.pour("A", int(secs * 1000))
    _last_action.update(action="water", seconds=secs, why=reason)
    log_act("executor", f"pump A {secs:.0f}s")
    return {"watered": True, "seconds": secs}


# ---------- Laya: the fast decider (our fine-tuned model) ----------
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
    LAST["laya"] = {"ts": time.time(), "pick": r["choice"], "sure": max(r["probabilities"].values()), "ms": r["ms"], "soil_pct": pct}
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


# ---------- rule brain (no AI) ----------

def rule_decide():
    for a in ("weather_agent", "soil_agent", "memory_agent"):
        log_act(a, "(rules) gathering")
    soil = get_soil("A")
    if "error" in soil:
        return "wait", 0, f"WAIT: {soil['error']}."
    pct, hrs = soil["moisture_pct"], soil["prediction"].get("hours_until_dry", 99)   # settling -> 99, moisture % decides
    fc = get_forecast()
    mem = get_memory()
    log_act("planner_agent", "(rules) deciding")
    if mem["failed_pours_recently"] >= 2:
        return "wait", 0, "WAIT: the last pours didn't reach the probe. Check the pump and tube before watering again."
    if pct >= config.WET_PCT:
        return "wait", 0, f"WAIT: soil is {pct:.0f}%, already wet."
    if pct > config.DRY_PCT + LOW_MARGIN:
        left = f", about {hrs:.0f} hours of water left" if "hours_until_dry" in soil["prediction"] else ""
        return "wait", 0, f"WAIT: soil is {pct:.0f}%{left}. Water only when it's low, then a real drink."
    rain_in = fc.get("hours_until_real_rain")
    if config.OUTDOORS and rain_in is not None and rain_in <= 3:      # indoors, rain never reaches the pot
        return "wait", 0, f"WAIT: soil is {pct:.0f}% but real rain is due in {rain_in} h. Let the sky do it."
    secs = (config.TARGET_PCT - pct) / pct_per_s()
    r = water_pot(secs, f"soil {pct:.0f}%, no rain coming")
    if r["watered"]:
        return "water", r["seconds"], f"WATER: soil is {pct:.0f}% and no rain is coming. Watering {r['seconds']:.0f} s."
    return "wait", 0, f"WAIT: wanted to water but {r['refused_because']}."


# ---------- Gemini team (Google ADK) ----------

def _model():
    if os.environ.get("GOOGLE_API_KEY"):
        return config.GEMINI_MODEL
    from google.adk.models.lite_llm import LiteLlm
    return LiteLlm(model="openai/" + config.RC_GEMINI_MODEL, api_base="https://right.codes/gemini/v1",
                   api_key=os.environ["RIGHTCODES_KEY_GEMINI"])


def which_brain():
    if config.USE_LLM == "rules":
        return "rules"
    if os.environ.get("GOOGLE_API_KEY"):
        return f"gemini ({config.GEMINI_MODEL})"
    if os.environ.get("RIGHTCODES_KEY_GEMINI"):
        return f"gemini via right.codes ({config.RC_GEMINI_MODEL})"
    return "rules"


def _build_team():
    from google.adk.agents import LlmAgent, LoopAgent, ParallelAgent, SequentialAgent
    m = _model()
    nums = "Use ONLY numbers the tools return. Never invent a number."
    weather = LlmAgent(name="weather_agent", model=m, output_key="weather_report",
                       tools=[get_forecast, get_drought, get_watering_rule],
                       instruction=f"You watch the sky for a small Florida farm in a drought. Call get_forecast, get_drought and "
                                   f"get_watering_rule. Report in 3 short lines: rain coming (when, how much), drought level, "
                                   f"watering rule. {nums}")
    soil = LlmAgent(name="soil_agent", model=m, output_key="soil_report", tools=[get_soil],
                    instruction=(f"You watch the soil. Call get_soil for pot 'A'. Report in 2 short lines: pot A moisture vs its "
                                 f"thresholds, and predicted hours until it is dry. {nums}") if config.ONE_POT else
                                (f"You watch the soil. Call get_soil for pot 'A' and for pot 'B'. Report in 3 short lines: "
                                 f"pot A moisture vs its thresholds, predicted hours until pot A is dry, pot B for comparison. {nums}"))
    memory = LlmAgent(name="memory_agent", model=m, output_key="memory_report", tools=[get_memory],
                      instruction=f"You are the farm's memory. Call get_memory. Report in 3 short lines: how much each pot got "
                                  f"in 24 h, what the last AI pours actually did to the soil (did water reach the probe?), and "
                                  f"the learned % gain per second of pumping. {nums}")
    planner = LlmAgent(
        name="planner_agent", model=m, output_key="planner_text", tools=[get_fast_decision, propose_plan],
        instruction=("You plan pot A's watering. Florida is in drought, so every drop counts, but the plant must not dry out.\n"
                     "WEATHER:\n{weather_report}\n\nSOIL:\n{soil_report}\n\nMEMORY:\n{memory_report}\n\n"
                     "CRITIC FEEDBACK ON YOUR LAST PLAN (fix it if there is any):\n{critic_feedback}\n\n"
                     "Rules of thumb:\n"
                     f"- Water only if pot A moisture is at or below {config.DRY_PCT + LOW_MARGIN}%.\n"
                     "- Don't water if real rain is due within about 3 hours, BUT ONLY if the forecast says "
                     "rain_reaches_pots is true. Indoors, ignore rain completely.\n"
                     "- If recent pours didn't reach the probe, WAIT and tell the farmer to check the pump.\n"
                     f"- One real drink, no sips: seconds = ({config.TARGET_PCT} - current%) / learned_pct_gain_per_second, max 30.\n"
                     "- First call get_fast_decision: Laya, our model trained on 6 years of Miami weather, gives its pick. "
                     "Follow it unless the data above clearly says otherwise, and if you overrule it, say why in the reason.\n"
                     "Call propose_plan exactly once. The farmer_sentence is one plain sentence a 13-year-old understands."))
    critic = LlmAgent(
        name="critic_agent", model=m, tools=[approve_plan, reject_plan],
        instruction=("You are the safety and water-waste critic. Check the planner's plan against the data.\n"
                     "PLAN: {plan}\n\nWEATHER:\n{weather_report}\n\nSOIL:\n{soil_report}\n\nMEMORY:\n{memory_report}\n\n"
                     "Reject if: it waters a pot that isn't low, it waters right before real rain that reaches the pots, "
                     "it waits for rain that can't reach the pots (indoors), the seconds math is wrong "
                     "by more than 3 s, it ignores failed pours, or the farmer sentence has a number the tools didn't give. "
                     "Otherwise approve. Call exactly one of approve_plan or reject_plan."))
    return SequentialAgent(name="farm_hand_check", sub_agents=[
        ParallelAgent(name="gather", sub_agents=[weather, soil, memory]),
        LoopAgent(name="plan_and_review", sub_agents=[planner, critic], max_iterations=3),
    ])


_team = None


async def _team_once():
    global _team
    from google.adk.runners import InMemoryRunner
    from google.genai import types
    if _team is None:
        _team = InMemoryRunner(agent=_build_team(), app_name="farmhand")
    s = await _team.session_service.create_session(
        app_name="farmhand", user_id="farm",
        state={"critic_feedback": "none yet", "plan": {}, "approved": False,
               "weather_report": "", "soil_report": "", "memory_report": ""})
    async for ev in _team.run_async(user_id="farm", session_id=s.id,
                                    new_message=types.Content(role="user", parts=[types.Part(text="Run the check for pot A.")])):
        for fc in ev.get_function_calls() or []:
            log_act(ev.author, f"calls {fc.name}")
        if ev.content and ev.content.parts and any(p.text for p in ev.content.parts):
            log_act(ev.author, "reported")
    done = await _team.session_service.get_session(app_name="farmhand", user_id="farm", session_id=s.id)
    return done.state


_check_lock = __import__("threading").Lock()


def check_now():
    """One full cycle. Always logs a decision. One at a time: the button and the loop can't double-pour."""
    with _check_lock:
        return _check_now()


def _check_now():
    _last_action.clear()
    brain = which_brain()
    t0 = time.time()
    LAST["check"] = {"t0": t0, "t1": None, "brain": brain}
    try:
        if brain != "rules":
            get_fast_decision()                            # Laya's instant call lands on screen first; the team explains after
        if brain == "rules":
            got = laya_decide()
            if got:
                brain = "laya (fast decider)"
                action, secs, sentence = got
            else:
                action, secs, sentence = rule_decide()
        else:
            st = _run(_team_once())
            plan, approved = st.get("plan") or {}, st.get("approved")
            sentence = plan.get("farmer_sentence") or "WAIT: no plan came back."
            if not approved:
                action, secs = "wait", 0
                sentence = "WAIT: the critic didn't approve a plan in 3 rounds, so the safe move is to wait."
                log_act("executor", "no approved plan -> wait")
            elif plan.get("action") == "water":
                r = water_pot(plan.get("seconds", 0), plan.get("reason", ""))
                action, secs = ("water", r["seconds"]) if r["watered"] else ("wait", 0)
                if not r["watered"]:
                    sentence = f"WAIT: the plan said water, but the safety rules said no ({r['refused_because']})."
            else:
                action, secs = "wait", 0
                log_act("executor", "approved wait")
    except Exception as e:                                  # AI down -> rules, never skip a check
        print("[brain] AI team failed, Laya then rules take over:", repr(e)[:300])
        _last_action.clear()
        got = laya_decide()
        if got:
            log_act("executor", "AI slow/failed -> Laya decided")
            brain = "laya (AI failed)"
            action, secs, sentence = got
        else:
            log_act("executor", "AI failed -> rules")
            brain = "rules (AI failed)"
            action, secs, sentence = rule_decide()
    store.add_decision(action, secs, brain, sentence, json.dumps(_last_action))
    LAST["check"] = {"t0": t0, "t1": time.time(), "brain": brain, "action": action}
    print(f"[brain] {brain}: {sentence}")
    return {"ts": time.time(), "action": action, "seconds": secs, "brain": brain, "sentence": sentence}


# ---------- farmer chat ----------

_chat = None


async def _ask(question):
    global _chat
    from google.adk.agents import LlmAgent
    from google.adk.runners import InMemoryRunner
    from google.genai import types
    if _chat is None:
        agent = LlmAgent(name="farm_helper", model=_model(),
                         tools=[get_soil, get_forecast, get_drought, get_memory, get_decision_log],
                         instruction=(("You answer a farmer's questions about their pot (A, watered by the AI) and the timer baseline it is compared to. "
                                       if config.ONE_POT else "You answer a farmer's questions about their two pots (A = AI watered, B = timer). ")
                                      + "Use the tools, answer in 1-3 short plain sentences, and use only numbers the tools give."))
        _chat = InMemoryRunner(agent=agent, app_name="farmhand_chat")
    s = await _chat.session_service.create_session(app_name="farmhand_chat", user_id="farmer")
    out = ""
    async for ev in _chat.run_async(user_id="farmer", session_id=s.id,
                                    new_message=types.Content(role="user", parts=[types.Part(text=question)])):
        for fc in ev.get_function_calls() or []:
            log_act("farm_helper", f"calls {fc.name}")
        if ev.content and ev.content.parts:
            out = "".join(p.text or "" for p in ev.content.parts) or out
    return out.strip()


def ask(question):
    if which_brain() == "rules":
        d = get_decision_log(1)
        return "Chat needs Gemini (set GOOGLE_API_KEY). Last decision: " + (d[0]["said"] if d else "none yet")
    try:
        return _run(_ask(question))
    except Exception as e:
        return f"Chat failed: {e!r}"[:300]
