## 5b. The live view: the Farm Hand dashboard

House style (the `visual-page` tokens): light "lab" theme, blue = the AI pot and the agents, orange = the timer, Bricolage Grotesque / Atkinson Hyperlegible Next / JetBrains Mono.

The 3D model is built in Blender, not drawn by hand in code:
- `blender/build_farmhand.py` builds it inside Blender through the Blender MCP socket (`blender/mcp_send.py`, port 9876) and exports `laptop/static/models/farmhand.glb`.
- It's one pot cut in half so you see into the soil. Every part has a name the page drives live:
  - `Soil_L0` to `Soil_L5`: 6 depth layers, recolored by moisture at that depth
  - `WaterFront`: slides down while a pour soaks in
  - `ProbeLED`: green ok, red dry, blue pumping
  - `Rim`: glows blue while the agents work
  - `Nozzle`: water drops fall from it while the pump runs
- `laptop/static/scene.js` loads the model with three.js and does the live part.
- Change the model: edit `build_farmhand.py`, send it to Blender, and refresh the page.
- Preview render: `blender/preview.png`.

Screenshots (fake board): `laptop\data\v7_*.png`.

Three columns, and the 3D model sits in the middle:
- **Left:** the call ("Watering 15 s" / "Holding off") with the reason and which brain decided. Buttons: **Run agents**, **Test pour** (goes through the same safety rules), Stop. Then the pot's moisture card and the timer-schedule card, when the pot goes dry, rain in the next 24 h, evaporation, % of the county in drought, and the water-saved score.
- **Middle, the 3D model:** the pot cut open, soil colored by depth, the probe blade in the cut, the water tube and nozzle. Buttons on top switch the soil coloring: Soil / Moisture / Heat.
- **Right, the agent team, always visible:** the dry-time model, the 3 gatherers side by side, the planner, the critic (loops up to 3 rounds), safety rules, pump, pour detector. Each one lights up blue while it's working. Below it: every safety rule with a live pass/fail, and a log of every step. Tabs: **Pours** (what each pour did + learned rate) and **Ask** (Gemini chat, 3 suggestion buttons).

Honesty labels on screen:
- the depth shading and the sinking water band are a model, and the caption says so ("only the probe % is measured")
- the dry-time model label says "trend estimate" until XGBoost is trained on real runs

Next step: put a second probe deeper in the pot (you have 3 spare) on pin 34 and time the water between the two. Then the water band becomes a real measurement instead of a model.

