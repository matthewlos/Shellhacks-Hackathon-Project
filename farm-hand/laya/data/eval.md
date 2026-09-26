# Farm Hand Laya: test on 2025-01-01 .. 2026-09-19 (never seen in training)

Run 2026-09-23 18:41.

## 1. Accuracy on held-out decisions

- decisions: 7524
- accuracy: **0.941**
- balanced accuracy (each move counts the same): **0.858**
- per move: water 3643/3917 (0.930), wait_rain 161/240 (0.671), wait_moist 3275/3367 (0.973)
- speed: 3.6 ms per decision (batched, RTX 4070)

Confusion (true -> predicted): wait_moist->wait_moist: 3275, wait_moist->wait_rain: 25, wait_moist->water: 67, wait_rain->wait_moist: 11, wait_rain->wait_rain: 161, wait_rain->water: 68, water->wait_moist: 131, water->wait_rain: 143, water->water: 3643

## 2. Season replay: a simulated field on real 2025-26 Miami weather

15048 hours (2025-01-01 .. 2026-09-19). Timer = 5.29 mm every morning (the hottest month's average crop water use, 2019-24).

| brain | irrigation (mm) | gallons per acre | hours past the stress line | lost below the roots (mm) |
|---|---:|---:|---:|---:|
| timer | 3316.8 | 3,545,691 | 12 | 3181.2 |
| rules | 1419.7 | 1,517,632 | 10 | 1284.1 |
| laya | 1452.8 | 1,553,052 | 0 | 1317.2 |
| oracle | 1415.2 | 1,512,888 | 0 | 1279.6 |

Laya vs timer: 56.2% less irrigation, 1,992,639 gallons per acre saved, stress hours 0 vs 12.

⚠️ Simulated field (FAO-56 bucket, assumed sandy soil, Kc 1.05) on real weather. Not a measured farm.