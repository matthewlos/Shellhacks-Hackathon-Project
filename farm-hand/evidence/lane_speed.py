"""Evidence: how fast is one tool-calling ADK agent on each right.codes Gemini model?"""
import asyncio, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "laptop"))
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types
def get_soil(pot: str = "A") -> dict:
    """Soil moisture for a pot."""
    return {"pot": pot, "moisture_pct": 37.0}
async def one(model):
    a = LlmAgent(name="t", model=LiteLlm(model="openai/" + model, api_base="https://right.codes/gemini/v1",
                 api_key=os.environ["RIGHTCODES_KEY_GEMINI"]), tools=[get_soil],
                 instruction="Call get_soil for pot A, then say the number in one sentence.")
    r = InMemoryRunner(agent=a, app_name="t"); s = await r.session_service.create_session(app_name="t", user_id="u")
    out = ""
    async for ev in r.run_async(user_id="u", session_id=s.id, new_message=types.Content(role="user", parts=[types.Part(text="go")])):
        if ev.content and ev.content.parts: out = "".join(p.text or "" for p in ev.content.parts) or out
    return out
for m in sys.argv[1:]:
    t0 = time.time()
    try:
        o = asyncio.run(asyncio.wait_for(one(m), 90))
        print(f"{m}: {time.time()-t0:.1f} s -> {o[:80]!r}", flush=True)
    except Exception as e:
        print(f"{m}: FAIL after {time.time()-t0:.1f} s {e!r}"[:200], flush=True)
