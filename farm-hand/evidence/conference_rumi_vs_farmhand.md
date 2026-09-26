# Judges' conference: Rumi vs Farm Hand (ShellHacks 2026)

Run 2026-09-23 17:38. Brief: `tools/conference_brief.md`.

## Round 1 (alone)

### GPT (gpt-5.5) (46 s)
| Project | Impact | Technical | Creativity | Demo | ShellHacks Fit |
|---|---:|---:|---:|---:|---:|
| **Rumi** | 8 | 8 | 8 | 9 | 8 |
| **Farm Hand** | 9 | 9 | 9 | 7 | 9 |

**Verdict**

**Overall winner: Rumi.** It has the more finished product, clearer user value, and lower demo risk; the room scan, shopping results, budget, and 3D placement form one coherent loop.  
**More prizes: Farm Hand, if the hardware and latency hold.** It maps directly to Social Good, AI-for-good, Google/ADK, and hardware judging, while Rumi is strongest in general-purpose product and developer-tool categories.  
Farm Hand has the higher ceiling and the uglier failure mode: a delayed agent, fake-looking water model, or unexplained savings claim turns the demo into theater.

**Single biggest change that lets the loser beat the winner**

For Farm Hand: replace the food-box “smart irrigation” demonstration with a credible measured comparison. Run identical soil beds or pots for at least 24 hours, compare timer irrigation against Farm Hand, log moisture, delivered volume, plant stress, sensor calibration, and failure cases, then show the results live. The system does not need a farm, but it does need evidence that the controller saves water rather than merely hitting a moisture target.

**Question that could sink Farm Hand**

“Show me the measured water savings against a timer over a meaningful run, and tell me exactly which numbers are measured, simulated, replayed, or assumed.”

If they cannot answer that cleanly, the headline impact claim collapses. The three-pulse test proves adaptive control and blockage detection; it does **not** prove agricultural water savings. The judges will also notice that the code existed before the event, Gemini may be too slow for the live loop, and the 3D water spread is explicitly modeled. Those are acceptable only if disclosed plainly and supported by real sensor logs.

### Claude (claude-sonnet-5) (16 s)
## Scores

**Rumi**
- Impact: 5 (nice-to-have, dorm shopping is a real but low-stakes problem)
- Technical: 8 (LiDAR scan-to-3D pipeline, real-time sync between chat/agent/3D scene, real product retrieval and placement is genuinely hard)
- Creativity: 7 (execution is the creative part more than the idea)
- Demo: 9 (visual, tactile, instantly understandable, "wow" in 10 seconds)
- Fit for ShellHacks: 6 (consumer AI shopping doesn't map cleanly to Google Cloud/Social Good/AI4Good tracks, but Best Overall/GitHub are open lanes)

**Farm Hand**
- Impact: 9 (real water crisis, real drought data, real farm economics, cost story is concrete: $73 vs $4,000)
- Technical: 8 (multi-agent Gemini pipeline with critic/rollback, XGBoost predictor, pour-detector learning soak rate, firmware safety overrides — that's a full stack, not a toy)
- Creativity: 8 (the "critic can send the plan back" and code-level override of the AI is a smart, judge-legible safety story)
- Demo: 7 (physical hardware demo is riskier live but the "Hit the Target" and "Pinch test" bits are excellent judge-interaction moments if they work)
- Fit for ShellHacks: 9 (sustainability, hardware, agentic AI, social good — hits nearly every 2025-style track at once)

## Verdict
Rumi wins the room on polish and is the safer bet for Best Overall given it already has HackMIT judges' validation. Farm Hand wins more prizes at ShellHacks specifically because it's a track-magnet (Google Cloud/ADK, Social Good, AI4Good, hardware bonus) and judges reward mission + hardware risk at this kind of event. Farm Hand's failure mode is a flaky live demo; Rumi's is being seen as "just a cool shopping app" with no track home.

## What would flip it
Farm Hand needs one clean real-world 24-hour water-saved number (even a partial run) — right now the headline claim is unverified, and a judge who asks "did you run this on real soil for a day" and gets "no" loses credibility instantly. A real number turns it from "cool demo" into "proven savings," which is the whole pitch.

## The question that sinks Farm Hand
"Walk me through what happens right now, live, if the Gemini agent step takes 180 seconds — do you have a fallback demo path, or does the audience just watch a spinner?" If the answer is vague, it exposes that the AI story (the differentiator vs. existing commercial soil controllers) may not actually be visible in a 3-minute demo slot.

### Gemini (gemini-3.1-pro) (21 s)
**1. Scores**
**Rumi**
Impact: 7 | Technical: 9 | Creativity: 8 | Demo: 9 | Fit for ShellHacks: 7

**Farm Hand**
Impact: 9 | Technical: 8 | Creativity: 9 | Demo: 8 | Fit for ShellHacks: 10

**2. Verdict**
**Winner Overall & Most Prizes:** Farm Hand. 
**Why:** 
1. It tackles a hyper-local Florida crisis (agriculture/water), perfectly aligning with ShellHacks sponsor tracks (Google Cloud, Social Good, Hardware). 
2. Rumi is a slick commercial startup, but Farm Hand’s interactive physical hardware and live feedback loops are pure hackathon bait. 
3. Physical risk-taking (the "pinch test" and "hit the target") historically scores higher with MLH judges than polished software screens.

**3. Biggest thing to make the LOSER beat the winner**
Farm Hand's fatal flaw is its 64-180s Gemini agent latency. For Rumi to win, Farm Hand must fail live on stage. If Farm Hand stalls for three minutes while agents argue over a water pulse, judges will dismiss it as an over-engineered toy. Rumi wins by simply executing a flawless, instant, visually stunning live demo that makes Farm Hand look clunky and un-demoable. 

**4. The Sink Question for Farm Hand**
"If it takes your multi-agent Gemini architecture up to three minutes to decide to pulse a water pump, why did you force an LLM into this project instead of using a standard PID controller that calculates soak rates locally on the ESP32 in milliseconds?"

### Grok (grok-4.6) (0 s)
(FAILED: <HTTPError 404: 'Not Found'> {"error":{"code":"model_not_found","message":"模型不存在","param":null,"type":"invalid_request_error"}})

## Round 2 (after reading each other)

### GPT (gpt-5.5) (20 s)
**Final vote: Rumi wins ShellHacks 2026 overall.**

I am not changing my mind. Farm Hand has the stronger mission and better sponsor-track fit, but its decisive claims are not yet proven: no meaningful timer comparison, modeled water behavior, hardware-demo fragility, and agent latency of up to three minutes. Its “Hit the Target” demo proves responsive control, not water conservation at farm scale. Rumi delivers a tighter, more complete loop with lower demo risk and immediate judge comprehension.

Farm Hand could still win more specialized prizes, especially Social Good, AI-for-good, Google/ADK, or hardware.

**The one change that most raises Farm Hand’s odds:** run and present a real 24-hour controlled comparison against timer irrigation, with measured water volume, moisture curves, sensor failures, and savings. Put the raw results beside the live demo and label every simulated or modeled element. That evidence would convert Farm Hand from an impressive prototype into a credible agricultural system.

### Claude (claude-sonnet-5) (9 s)
**Final vote: Farm Hand wins ShellHacks 2026 overall.**

I didn't change my mind on prizes but I'm shifting my overall pick. Both GPT and Gemini landed on Farm Hand having the higher ceiling and better track fit, and Gemini's point about physical judge-interaction ("pinch test," "hit the target") beating polished screens at MLH-style judging is the thing that moved me — that's not a Best Overall consolation prize, that's the actual winning behavior at events like this. Rumi is the safer, more finished product, but "safe and finished" reads as *incremental* next to a live drought-relevant hardware demo with a judge's finger on the tube. Rumi still takes Best Overall/GitHub-type lanes on polish alone.

**One change that most raises Farm Hand's odds:** ditch the live Gemini call during the timed demo entirely — run the agent decision pre-recorded/cached for the "Hit the Target" moment and disclose that plainly, so the 64-180s latency never touches the stage clock. Save the live LLM call for Q&A, not the money shot.

### Gemini (gemini-3.1-pro) (17 s)
**Final Vote:** Rumi wins Best Overall. Farm Hand sweeps the sponsor tracks.

**Did I change my mind?** Yes, I flipped Best Overall to Rumi. GPT and Claude correctly highlighted the demo risk. A hackathon pitch is exactly three minutes. If Farm Hand takes 180 seconds to fire a water pump because of multi-agent bloat, it’s dead on arrival for the top prize. Rumi guarantees a flawless, instantly understandable visual loop. Farm Hand will win sponsor tracks on its Florida-specific mission and hardware cost, but Best Overall demands airtight execution.

**One change to raise Farm Hand's odds:** Fix the demo latency. Swap the heavy multi-agent architecture for a hyper-fast model (like Gemini Flash) or use a seamless local fallback. The interactive "Hit the Target" and "Pinch Test" are hackathon gold, but if they don't execute in under 10 seconds live, the demo is just theater.
