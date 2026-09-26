## Blunt verdict

The winning story is not “many agents.” It is: **a judge gives Farm Hand an unpredictable physical challenge, and the system measures, reasons, waters, verifies, and safely stops—live.**

### A) Judge wow per build-hour

1. **Vision agent** — Best payoff: the judge shows it real soil, Gemini notices a visible condition, and the probes either confirm or challenge it.
2. **Schedule optimizer** — Strong technical core; turns forecasts, ET0, drought rules, and learned pump response into a defensible decision.
3. **A2A Water District** — Excellent prize alignment and storytelling, but it risks looking like two chatbots role-playing unless the negotiation materially changes the pump plan.
4. **Live SMS** — Memorable polish, but technically shallow and dependent on cellular/API reliability; make it a stretch goal.
5. **50-farm simulation** — Useful impact evidence, but weak live-demo magic and vulnerable to “these savings are simulated” criticism.

### B) Three stronger new ideas

#### 1. “Hit the Target” closed-loop irrigation challenge

**20-second moment:** A judge chooses a target—say 38% moisture. Farm Hand delivers tiny pulses, watches the real soil response, updates its learned pump-to-moisture model, and stops inside the target band. The dashboard shows: **target 38%, achieved 38.6%, 43% less water than timer.**

**Hard core:** Online system identification, delayed sensor response, pulse sizing, settling time, uncertainty bands, overshoot prevention, and receding-horizon control.

**Prize fit:** Best Overall, Google Cloud/ADK, Gemini, Microsoft AI for Good.

This should be the centerpiece. It proves the system can act, learn, and close the loop—not merely recommend.

#### 2. “Catch Me Lying” sensor-fusion challenge

Add a cheap load cell plus HX711 under the pot—roughly $10–20.

**20-second moment:** The judge pinches the water tube during a commanded pour. The relay says the pump ran, but pot weight and soil moisture do not increase. The critic flags **probable blocked line**, cancels further watering, and requests inspection.

Alternatively, the judge pours water manually; Farm Hand detects unexplained mass gain and refuses to double-water.

**Hard core:** Reconciling actuator state, mass change, moisture response, sensor confidence, and causal fault classification.

**Prize fit:** Best Overall, Microsoft AI for Good, Google Cloud.

This is an unusually strong safety demo because the judge creates the failure themselves.

#### 3. Physical Timer-vs-AI irrigation arena

Use two transparent containers, two pumps, and matched dry soil. One follows a fixed timer; Farm Hand uses closed-loop pulses. A phone camera tracks the visible wetting front.

**20-second moment:** Both pumps start together. The timer keeps pouring toward saturation or drainage while Farm Hand stops. The 3D visualization mirrors the measured wetting depth, and the screen displays actual pump runtime—not invented gallons.

**Hard core:** Multimodal fusion between camera-observed wetting, depth probes, pump calibration, and the soil-response model.

**Prize fit:** Best Overall, Gemini multimodal, Google AI for Social Good.

Unlike a virtual comparison, judges can physically see the wasted water.

### C) Hero demo: under 90 seconds

**0–8 seconds:** Hand a judge the phone. They photograph the soil and select a target moisture. This makes the input unpredictable and visibly live.

**8–20 seconds:** Weather, soil, vision, and memory agents run in parallel. Display short evidence cards—not chat transcripts:

- “Hot/dry forecast”
- “Surface crust detected”
- “Deep probe still moist”
- “Pump response: 1.8% ± 0.4% per second”

**20–30 seconds:** The planner proposes one long pour. The Water District A2A agent rejects it under the current drought budget. The critic identifies overshoot risk. The revised plan becomes three measured pulses.

**30–65 seconds:** Farm Hand executes pulse one. Sensors respond. The learned response model updates. Pulse two becomes shorter. The transparent pot and 3D cutaway show the wetting front moving downward.

**65–78 seconds:** The system enters the target band and stops itself. The code-level guard visibly changes from `WATER_ALLOWED` to `TARGET_REACHED — LOCKED`.

**78–90 seconds:** Show one final receipt:

> Target: 38%  
> Achieved: 38.6%  
> AI pump time: 4.2 seconds  
> Timer baseline: 8 seconds  
> Measured reduction: 47.5%  
> Safety violations: 0

If available, end by pinching the tube for a one-line fault-detection encore—but do not jeopardize the main run.

### D) The three biggest ways this loses

1. **It looks like agent theater.**  
   Weather summaries and animated agents do not prove intelligence. Make agents produce competing plans with cited evidence, but let measurable optimization and deterministic guards control the pump.

2. **The live soil response fails or lags.**  
   Calibrate using the exact soil, container, probe depth, and pump before judging. Use short pulses, explicit settling states, a primed tube, redundant probes, an emergency stop, and a prepared second demo pot. Label any replay as replay.

3. **The impact claims outrun the evidence.**  
   Never turn one pot into “Florida saved millions of gallons.” Separate:

   - physically measured water,
   - virtual-timer counterfactual,
   - modeled projections,
   - external Florida statistics.

Cut statewide simulation, SMS, and NVIDIA unless the closed-loop physical demo is already bulletproof. One undeniable autonomous watering event beats ten half-working features.


