# Farm Hand opening story (Claude + GPT-6 Astra, 2026-09-24)

Sources and every quote: `story_draft.md` in this folder. Astra's full review is in the chat log of 2026-09-24.

## The 30-second opening (say it out loud)

"This spring, all of Florida was in a drought, the worst in 25 years.
At San Juan Family Nursery in Bonita Springs, they watered morning, night and all through the day. And some plants still had to be thrown away.
A dead plant isn't one bad day. You lose the time it took to grow it. You replant and start over.
In a drought, farmers can't afford to lose the crop, and they can't afford to waste the water either. A timer can't tell the difference. It waters on schedule, rain or shine.
Farm Hand reads the soil's moisture and temperature every second. A small, fast AI model makes the watering call, and a Gemini agent team checks the forecast so it can wait on the rain. [pump runs] It's watering this soil right now, only because the soil asked for it."

## The line they remember
"When a crop dies, you lose the time it took to grow it, too."

## Proof of concept framing (owner 2026-09-24)
"We did the hard part: real sensors, real pump, an AI that decides. Scaling is the easy part."
- Field: "One board reads several probes. The probes are waterproof, you run a longer wire. A field is more probes and more wire." (Only 1 probe proven: say it as the next step.)
- Rain: "The forecast check is already in the code. Our pot is indoors so it's switched off; in a field you flip it on." (`config.py:25`, OUTDOORS)
- Cost: "Cheap probes, a cheap pump, a small AI model, instead of paying for sprinklers on a timer."
- The nursery: "A setup like this watches every bed all day, so nobody has to." Don't say it "would have saved" the nursery: we can't know that.

## Keep it honest (Astra's flags we agree with)
- "Tell you if a crop can thrive here": not built. Say "next step", never "it does".
- "Wait on the rain": only live with OUTDOORS=1. Indoors say "in a field, it waits on the rain".
- "Whole field": say "one board can read several probes, so a field is the next step". Only one probe is proven.
- "Saves water": only say a number once the real run has one. Label the timer as "estimated: schedule × measured flow".
- "Right now" line: only while the pump is actually running.

## Control pot
Overkill. One real AI pot + the virtual timer baseline (already built, ONE_POT=1), clearly labeled. The judge-pours-water moment beats a second pot.
