# Farm Hand: speaker script (ShellHacks 2026)

Open `Farm Hand Deck.html` in Chrome and press **F** for fullscreen.
Next: click, →, or Space. Back: ←. Jump to any slide: add `#s15` to the end of the URL (slide 15, step 1).
Have the dashboard (farmhand.dmchang.xyz) open in a second tab, with both boxes on the table.

Main deck: about 2.5 min with the demo. `[click]` = one click. The lines in quotes are what you say.

---

## 1. Title
`[click]` "We're Farm Hand."

## 2. The news
`[click]` four headlines land. "This year, this was the news in Florida."
`[click]` four more. "Sixty-one counties declared disaster areas. The worst drought in twenty years. Three billion dollars in crop losses."

## 3. The hook
`[click]` the plant grows for two years. "When a crop dies, you don't just lose the plant."
`[click]` it dies and the bar drains. "You lose the time it took to grow it."

## 4. The drought
`[click]` "This spring, 80% of Florida was in extreme drought."
`[click]` "And all of Miami-Dade is still in drought. At one nursery in Bonita Springs, WINK News called it the worst drought in 25 years. They watered all day and still threw plants away. A timer can't tell wet soil from dry."

## 5. How it works
`[click]` "Farm Hand reads the soil every second."
`[click]` "Our decision model decides in a tenth of a second: water now, or wait."
`[click]` "And the pump waters only if the soil needs it."

## Live demo (at the table), about 1 minute
1. Show box A live: moisture, temperature, the decision model's call.
2. `[hand the judge the cup]` "Pour it into both boxes." Farm Hand skips its next drink; the timer waters anyway.
3. Pinch the tube: Farm Hand notices the soil didn't rise.
4. Pick a target %: it pulses and locks on.
5. "Rain can't reach this box, so here's the same brain on a whole season." → back to the deck.

## 6. Results (the two boxes)
`[click]` "The timer poured 8 times, 4.8 liters."
`[click]` "Farm Hand gave 2 drinks, 0.8 liters, and never let the soil drop below its line."
`[click]` "That's 83% less water."

## 7. Season
`[click]` "In our season replay on real Miami weather, a timer used 3.5 million gallons an acre."
`[click]` "Farm Hand used 56% less."

## 8. Cost
`[click]` "One farm soil sensor costs $1,200."
`[click]` "All our parts cost $72.94."

## 9. Sponsor tech
`[click]` ×5, quickly: "Five sponsors, each doing real work: Gemini for our data, AI built into the experience instead of a chat window for Microsoft, an ElevenLabs voice, Tiger Cloud for the time series, and a private local model for Assurant."

If a judge asks for more:
- **Gemini:** we built Farm Hand with Gemini in Google AI Studio. It pulls, analyzes and plots our data: satellite farmland across Miami-Dade (1,347 farms, crop type right 87% of the time), the weather, and which crops fit each field.
- **Microsoft:** the decision model reads real soil every second and waters on its own, with the reason on screen. Growers slide moisture and temperature to find crops that will grow, then send that setting straight to the model.
- **ElevenLabs:** one tap on Listen and an ElevenLabs voice reads each box's moisture, temperature and what the decision model is doing. Hands-free for growers in the field.
- **Tiger Data:** Tiger Cloud stores every sensor reading as a time series, with 1-minute and 1-hour rollups and compression, so live charts stay fast.
- **Assurant:** the decision model runs locally on our own machine, so farm data never leaves it (privacy). Every call shows its reason and the water it used (spending visibility). We picked a small local model because it answers in milliseconds, where a cloud agent took 64 to 180 seconds (confident tool choice).

## 10. Next
`[click]` "Today, Farm Hand runs one box on our table."
`[click]` "Next, real farms, and we already know where they are: 1,347 farms, 18,865 acres. See every crop bed live, for $73 instead of $1,200. Thank you."

---

## Backup slides (slides 11 to 21)
| Slide | For the question |
|---|---|
| 11 Cup test | Demo backup if the live pour fails |
| 12 How it works, in detail | "How does the data move?" (ESP32, FIU WiFi, Mac mini) |
| 13 Decision model: 94.1%, 115 ms | "How good is the AI?" |
| 14 Crop engine | "Which crops fit?" |
| 15 What grows on the farms | "What's actually planted out there?" (727 avocado farms, 447 vegetable) |
| 16 Drought chart | "Where's the drought data from?" |
| 17 Safety rules | "What if the AI is wrong or the WiFi drops?" |
| 18 Where the model is strong | "What's it bad at?" (rain calls) |
| 19 One timer can't fit every crop | "Why not just a better timer?" |
| 20 Sources | Where the numbers come from |
| 21 Where the headlines come from | Links for the 8 news clippings on slide 2 |

## Before you present
- Step through every slide once, forward and back.
- Slide 10's field tiles are drawn. When the real map render is ready, swap it in and run `python3 pitch/deck/build.py`.
- Team photos: drop them in and they'll replace the initials.
