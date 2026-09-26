You are judging-panel-level advisor for a ShellHacks 2026 (FIU, Miami, 36 hours, ~1,400 hackers) hardware+AI project. Think hard. Be concrete and ruthless. No code, just ideas and reasoning.

PROJECT: "Farm Hand". One pot of soil (Florida sandy potting mix), ESP32 with a capacitive soil moisture probe + DS18B20 soil temp probe, a relay + 3-5V pump that waters it. Laptop runs a Google ADK multi-agent team on Gemini: weather / soil / memory agents gather in parallel (ParallelAgent), a planner and a critic loop until the plan holds (LoopAgent), code-level safety guards decide if the pump may run, a pour detector measures what each pour actually did to the soil and teaches the system (learned % moisture per pump second). XGBoost predicts hours until dry. Live feeds: Open-Meteo forecast + ET0, US Drought Monitor (Miami-Dade 100% in drought, 55.4% severe, Sept 2026). The comparison is a "virtual timer" (what a normal sprinkler schedule would pour) vs what the AI poured. Dashboard: three.js 3D model of the pot cut open, soil shaded by moisture at depth, agent team lighting up live. Florida context: worst drought since 2012, SWFWMD Phase III water restrictions, farm losses ($3.1B freeze + drought), a Chiefland farmer checks soil probes by hand, a Gainesville blueberry farm lost 70% of its crop.

Budget: parts on hand (ESP32 x3, 5 soil probes, 5 DS18B20, 4 pumps, 4 relays, breadboard). Can buy cheap add-ons (< $40). A phone camera is available. One developer, 36 hours, plus AI coding help.

ShellHacks 2025 prizes that matter: Best Overall (2 of 3 went to sustainability, software only), Google Cloud ($4,000; ADK agents with a loop and/or parallel agents, or the A2A agent-to-agent protocol), MLH Best Use of Gemini, Microsoft AI 4 Good (sustainability), NVIDIA (Jetson), Google AI for Social Good.

The user wants the AI layer MUCH bigger and the single biggest "wow" moment for judges, without faking anything (judges will ask "show me").

Candidate ideas so far:
1. A2A: the farm agent negotiates water allotment with a separate "Water District" agent that enforces drought rules.
2. Vision agent: phone photo of soil surface, Gemini vision reads cracks/crust/pests, cross-checks the probe.
3. Schedule optimizer: simulate next 24 h (forecast, ET0, learned drying curve) and pick the least-water pour plan (model predictive control).
4. Texts the farmer a daily report, live SMS to a judge's phone.
5. Florida-scale labeled simulation: 50 virtual farms with real county drought/weather data, gallons saved statewide.

ANSWER:
A) Rank the 5 by judge wow per hour of build time, one line each on why.
B) Propose 3 NEW ideas that beat these (hardware+AI, buildable in 36 h, honest). For each: the 20-second demo moment, what makes it technically hard (judges reward a hard core), and which prize it hits.
C) Pick ONE hero demo sequence (under 90 seconds on stage) that combines the best pieces, step by step.
D) The 3 biggest ways this project loses, and how to prevent each.
Keep it under 900 words.
