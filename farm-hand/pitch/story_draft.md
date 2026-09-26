# Farm Hand pitch story: draft for the Astra review (2026-09-24)

## Owner's own words (what he wants to say)
Saving water when it matters, in a drought. Monitoring the crop so it doesn't die off: if a crop dies in a drought, that's months of planting lost, you plant again and wait longer, so keep it alive. We monitor soil moisture + temperature (soil health) and can tell you if something is fit to thrive there. A dirt-cheap decision model (Laya) makes the call; Gemini pulls the latest weather forecast and says "hold the water, wait on the rain." Cheap tech that could cover a whole field, not one farm. Question: "one that's AI monitor, one that's control" — is the control overkill?

## Real stories, all sourced (videos pulled with yt-dlp, captions read)
1. San Juan Family Nursery, Bonita Springs (WINK News, 2026-04-27, https://youtu.be/_1h8z__p558). Worst drought in 25 years in SW Florida. Ariely San Juan: "For some plants this season, they honestly just had to be thrown away. Then, when it comes to regrowing them to kind of be ready for sale, you kind of get backtracked a lot now with the drought." Watering morning, night and through the day. Dry season got ~40% of normal rain.
2. Gene McAvoy, A1 Palms, LaBelle (WINK News, 2026-05-06, https://youtu.be/I-8RYrzcIT0). Freeze then drought. Some growers lost 75% of their palms. "It's going to take a good year, and maybe even 2 years before they grow back out and are sellable." Palms only make 5-7 leaves a year. In drought, fertilizer "doesn't do much because it takes the rain to wash it into the soil."
3. David Tuthill, River & Root Farm, Gainesville blueberries (Independent Florida Alligator, June 2026): 70% crop loss even while watering daily in March-April.
4. Florida citrus (FOX, Bartow, 2026-03-09, https://youtu.be/YgUaVoT9JfQ): "100% of Florida is in a drought, the state's worst dry spell in 25 years." Citrus went from ~900,000 acres in 2000 to just over 200,000 (USDA). Dundee Citrus grower: "During the bloom period, water is critical. It determines how well the fruit sizes, and ultimately how large your crop will be." They now use tents partly to manage soil moisture.
5. NewsNation from Miami (2026-02-11, https://youtu.be/REBxMkXy17c): DeSoto County in extreme drought for the first time since 2001; ~95% of Florida in moderate drought or worse; over $1B in crop damage from freeze + dry.
6. Still happening: 2026-09-16 USDA declared Orange, Osceola, Seminole, Escambia drought disaster areas; ~43% of Florida in drought as of 2026-09-15. SWFWMD Phase III "Extreme" shortage through Oct 1 2026: lawns once a week. Farm irrigation = 40% of Florida freshwater withdrawals (USGS 2010); up to 50% of irrigation water is wasted (UF/IFAS-linked guidance).

## Draft 30-second story
"Ariely San Juan runs a family plant nursery in Bonita Springs. This spring, in Florida's worst drought in 25 years, she watered morning, noon and night, and still had to throw plants away. And a dead plant isn't one bad day. It's months of growing, gone. You replant and start the clock over.
Farmers can't afford to lose the crop, and in a drought they can't afford to waste the water either. A timer can't tell the difference. Farm Hand can.
A $20 probe reads the soil's moisture and temperature every second. A tiny AI model makes the call in milliseconds, and a Gemini agent team checks the forecast: if rain is coming, it holds the water. It waters only when the soil actually needs it. Right here, it's watering real soil, live."

## What's built vs not (so the pitch doesn't overclaim)
- Built + proven 2026-09-23: probe + temp probe + pump + relay on an ESP32; a 10 s pour took soil 44% → 52%; Laya fast decider (94.1% on held-out Miami weather); Gemini ADK team; forecast feed (Open-Meteo); pour detector learns %/s; virtual timer baseline (ONE_POT=1).
- ⚠️ "Wait on the rain": the code has it, but OUTDOORS=0 by default (indoors pot → the team ignores rain). For the pitch it must be shown with OUTDOORS=1 or described as what happens in a field.
- ❌ "Tell you if a crop is fit to thrive here": NOT built. Only moisture + temperature exist. No crop-suitability logic.
- Scale: one ESP32 can read several soil probes (ADC1 pins 32-39), so one board = several zones. Not demonstrated with >1 probe.
- The "control": one real pot watered by AI; the timer baseline is virtual (a timer's water use is just its schedule × measured flow). No physical control pot.
