# Farm Hand home server (Mac mini)

Always-on home for the data, the decisions and the website, so no laptop has to stay on.

```
ESP32 (FIU_WiFi) --POST readings every 10 s--> Mac mini receiver.py --reply: decision--> ESP32
                                                  |  SQLite: every reading + decision
Matthew pushes to GitHub --(checked every 60 s)--> deploy.sh builds ui-mui --> served at the site root
```

| URL | What |
|---|---|
| https://farmhand.dmchang.xyz/ | Matthew's site (`ui-mui` on `UI-Design-Work`), auto-deployed |
| https://farmhand.dmchang.xyz/farmhand/data | live data JSON (latest reading, decision, history) |
| https://farmhand.dmchang.xyz/farmhand/ | simple live page |
| POST https://dantes-mac-mini.tailb2bea0.ts.net/farmhand/reading | where the ESP32 posts (header `X-Farmhand-Token`) |

**For Matthew: just push.** The Mac mini pulls the public repo every minute (no credentials), runs `npm ci && npm run build` in `ui-mui/`, and swaps in `dist/`. A failed build keeps the old site up and is logged in `~/farmhand-site/deploy.log`. The site can read live data from `/farmhand/data` (same origin, no CORS).

On the Mac mini (user `dante`):
- `~/farmhand-server/` receiver.py, `.env` (the ESP32 token, never committed), `farmhand_home.db`, `server.log`. launchd: `com.farmhand.receiver` (always on).
- `~/farmhand-site/` deploy.sh + deploy.conf (repo, branch, app folder), `current/` = live build, `previous/` = last build. launchd: `com.farmhand.deploy` (every 60 s).
- Domain: `farmhand.dmchang.xyz` in `~/.cloudflared/config.yml` -> `localhost:8120`.
- Decisions: the baseline rule until Laya's weights are in `~/farmhand-server/model/farmhand-laya` (then Laya, with the baseline as a floor).
