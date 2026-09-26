# Judges' conference: Rumi vs Farm Hand at ShellHacks 2026

You are a hackathon judge. Be blunt and specific. No flattery. Judge the projects AS THEY WOULD BE DEMOED at ShellHacks 2026.

## The hackathon
- ShellHacks 2026 at FIU (Florida International University), Miami. Large student hackathon, 36 hours, MLH-style judging (impact, technical difficulty, creativity, demo/presentation, completeness).
- ShellHacks 2025 prize tracks (2026 list not confirmed yet): Google Cloud, Best Overall, Google Social Good, Microsoft AI 4 Good, GitHub, plus hardware-friendly judging.

## Project A: Rumi (real winner at HackMIT 2026: Long Lake "Convince a Non-Believer" winner + Ramp "Save Time, Save Money" 2nd place)
- An AI interior shopping agent. The iPhone app scans your real room with LiDAR (Apple RoomPlan) into an editable 3D room in the browser (React Three Fiber).
- You say e.g. "Help me furnish my dorm for $800 with a desk, chair, rug, lamp and storage, keep my bed." A design agent splits the room into zones, allocates the budget, and searches real products across stores (Exa retrieval), then places them in the measured room. Product list and total stay synced with the 3D plan. Move/lock objects, refine by chat, saved sessions.
- Stack: React + TypeScript, React Three Fiber/Drei, Convex backend, Clerk auth, iOS app, OpenAI.
- A similar project (PIXX-AR, photo -> furniture basket -> checkout via Visa agent APIs, 70+ MVP signups) won Visa's $5,000 at the same HackMIT, so this category had 2 winners.

## Project B: Farm Hand (planned for ShellHacks 2026; prototype built, hardware arriving)
- Problem: Florida grows much of America's oranges (51% of US orange value in 2020), is #1 in sugarcane, has most of the winter strawberries and more than half the fresh tomatoes. 2026 was Florida's worst drought since 2012: 79.5% of the state in extreme drought on Apr 7 2026; Miami-Dade still 100% in drought on Sep 15. A Gainesville farmer who lost 70% of her blueberries said "irrigation is missing places. Then trees die." Farms pump ~40% of Florida's fresh water (USGS 2010-12). UF/IFAS measured 40-70% water savings from soil-moisture control.
- Hardware: ESP32, $2.60 capacitive soil probe, DS18B20 soil temp probe, relay, mini pump, in a clear food-storage box of potting soil. Whole parts order $72.94. A farm-grade soil probe station costs up to about $4,000.
- AI: a Google ADK Gemini agent team: weather, soil and memory agents run in parallel; a planner proposes; a critic checks the math and can send it back (up to 3 rounds). Code-level safety rules (wet limit, daily cap, 30 s pump cap in firmware) can overrule the AI. A plain rule brain is the fallback. XGBoost "hours until dry" predictor. A pour detector measures what each pour actually did and learns the soil's soak rate. Chat agent answers from live data. Live feeds: Open-Meteo forecast/evaporation, US Drought Monitor.
- Hero demo "Hit the Target": a judge picks a moisture %, Farm Hand pulses the pump, learns the soil's rate live, and locks within 1% (fake-board test: 35.4% -> 54.3% in 3 pulses, 306 ml, 97 s). "Pinch test": the judge pinches the tube; after one pulse it stops and says water isn't arriving (expected +9.7%, saw -0.1%).
- Dashboard: live 3D model of the real setup (Blender -> three.js), water visibly spreading and soaking down (labeled "modeled"), agent team lighting up, receipt of every pulse.
- Known weaknesses: the Gemini lane measured 64-180 s per agent step on the current gateway (may fall back to rules mid-demo unless a faster model works); the demo is a food container, not a farm; soil-moisture controllers already exist commercially; the headline "water saved vs timer" number needs a real 24-hour run; code written before the event must be disclosed; one part (soil/water shader) is adapted from an MIT-licensed HackMIT project, credited.

## Your answer (keep it under 350 words)
1. Score each project 1-10 on: Impact, Technical, Creativity, Demo, Fit for ShellHacks. Show the numbers.
2. Verdict: if both were demoed at ShellHacks 2026, which wins overall, and which wins more prizes? Why, in 3 lines.
3. The single biggest thing that would make the LOSER beat the winner.
4. The one question you'd ask Farm Hand's team that could sink them.
