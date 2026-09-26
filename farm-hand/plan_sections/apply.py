"""One-time: splice the rewritten sections into PLAN_BODY.md."""
from pathlib import Path

H = Path(__file__).resolve().parent
p = H.parent / "PLAN_BODY.md"
s = p.read_text(encoding="utf-8")

a, b = s.index("## 5. The AI part"), s.index("## 6. Hackathon plan")
s = s[:a] + (H / "s5_ai.md").read_text(encoding="utf-8") + s[b:]

old3 = s[s.index("3. **Live (45 s):**"):s.index("5. **Number (15 s):**")]
s = s.replace(old3, (
    "3. **Live (45 s):** press \"Ask the agents now\" FIRST (it takes up to a minute). Then pull Pot A's probe out of the soil: "
    "moisture drops, the grass droops on screen, and the agent orbs light up one by one. The critic approves, the pump runs, "
    "water falls in the 3D view, the blue ring sinks, and the real pot gets wet. Push the probe back in.\n"
    "4. **Brain (20 s):** \"A team of Gemini agents. Weather, soil and memory run in parallel. A planner proposes, a critic "
    "checks its math and can send it back. The pump only runs if code-level safety rules agree. After every pour it measures "
    "what the water actually did and learns from it.\"\n"
    "   - Optional, 10 s: type \"why did you water pot A?\" into Ask the farm.\n"))

s = s.replace("| Gemini key/quota problem | Rule brain; dashboard says `rules (gemini failed)` |",
              "| Gemini key/quota problem or slow | Rule brain after `AI_TIMEOUT_S`; dashboard says `rules (AI failed)` |\n"
              "| Pots indoors, AI waits for rain | `OUTDOORS=0` (default) makes the team ignore rain |\n"
              "| Pump runs but the water misses the pot | Pour detector flags it; the team stops watering and says \"check the pump\" |")
s = s.replace("| 12-20 | Gemini agents (ADK), predictor trained on the pre-event data |",
              "| 12-20 | Gemini agent team (ADK), pour detector, predictor trained on the pre-event data |")
s = s.replace("- **Google Cloud** (ADK / A2A agents, $4,000 in 2025): ParallelAgent + the 15-min loop.",
              "- **Google Cloud** (ADK / A2A agents, $4,000 in 2025): ParallelAgent (3 gatherers) + LoopAgent (planner/critic) + the 15-min loop.")

a = s.index("## 11. What was tested")
s = s[:a] + (H / "s11_tested.md").read_text(encoding="utf-8")
p.write_text(s, encoding="utf-8")
print("ok")
