import json
d=json.load(open("winners.json",encoding="utf-8"))
def esc(s): return s.replace("|","\|").replace("\n"," ").strip()
by={r["url"].rsplit("/",1)[1]:r for r in d}
def gh(slug):
    g=by[slug]["github"]; return g[0] if g else "none shown"
top=[
("priorityqueue","<PriorityQueue>",2025,
 "Puts power plants and projects waiting in the grid interconnection queue on a Mapbox map, groups nearby projects into clusters with Elastic geospatial search, and lets a grid manager approve or reject them. Same world as GridLock (grid transmission planning, FERC Order 2023) and the same core move: group projects by location so they can share one build.",
 "Their clustering idea (nearby projects share upgrade costs) is basically our coordination-opportunity pitch; copy the Mapbox + geo-query setup and the 'shared cost split' angle for our cost estimate."),
("tribune","Tribune",2026,
 "Scrapes city council agendas, municipal codes and government PDFs overnight, pulls out ~200 policies, geo-tags the affected neighborhoods, and shows them on a Mapbox map. That is the hardest part of GridLock: turning messy public government documents into clean, mapped records.",
 "Their PDF-to-structured-records pipeline (scrape, LLM extract, geo-tag, cite the source clause) is what we need for utility IRP/transmission plan PDFs; also borrow 'every record links back to its source page' so judges trust the data."),
("gridveda","GridVeda",2026,
 "Power-grid tool for utility operators: watches 20 substation transformers and scores which are likely to fail, with a ranked risk dashboard. Same buyer (utilities) and same output shape (a ranked list of what to act on first).",
 "Their ranked health/risk scoring UI and 'alert above a threshold' pattern map straight onto our touching / 1.6 km / 8 km / 40 km tiers; the utility-industry framing (aging assets, outage cost stats) is good pitch material."),
("containos","ContainOS",2026,
 "Wildfire command dashboard on a Leaflet map that pulls in wind, terrain, infrastructure (including powerlines) and population data, then produces prioritized alerts. Close on interactive map + many public data layers + ranked alerts.",
 "Their pattern of 'compute the hard numbers deterministically first, then let the AI explain them' fits us: do distance/timeline overlap in plain code (PostGIS/Shapely), use the LLM only to write the why for each flag."),
("erwin-enhanced-rock-weathering-impact-navigator","ERWIN: Enhanced Rock Weathering Impact Navigator",2025,
 "Carbon-removal tool: pick a region on a Mapbox map, enter project parameters, and it scrapes public soil/weather data and runs a science model to estimate impact. Close on the 'map + public data + impact estimate' piece.",
 "Borrow the pick-an-area-then-get-an-estimate flow for our cost/impact estimate on each overlap (miles of shared corridor, dollars saved)."),
]
L=[]
L.append("# TreeHacks winners (2024, 2025, 2026) vs GridLock\n")
L.append("Scraped 2026-09-25 from the Devpost galleries (treehacks-2024/2025/2026.devpost.com/project-gallery) and each winner's Devpost page. Prizes are copied exactly as the Devpost project page lists them. GitHub = first GitHub link on the Devpost page.\n")
L.append("Counts: 2024 = 60 winner entries (one is named \"Test Project\", see note), 2025 = 70, 2026 = 64. Total 194.\n")
L.append("## Top 5 closest to GridLock\n")
for i,(slug,name,y,why,borrow) in enumerate(top,1):
    r=by[slug]
    L.append(f"### {i}. {name} ({y})\n")
    L.append(f"- Prize: {'; '.join(r['prizes'])}")
    L.append(f"- Why close: {why}")
    L.append(f"- What to borrow: {borrow}")
    L.append(f"- Devpost: {r['url']}")
    L.append(f"- GitHub: {gh(slug)}\n")
L.append("Honorable mentions: CalTrack 2026 (wildfire map with population density and risk overlays, [NVIDIA] Edge AI Track), Plot 2025 (location insights on Mapbox, LangChain prize), SkySplat 2024 (drone 3D models for infrastructure inspection, Sustainability Grand Prize).\n")
L.append("Honest note: no TreeHacks winner in these three years does exactly GridLock (two utilities' transmission plans + distance/timeline overlap). PriorityQueue is the only one about transmission/interconnection planning.\n")
L.append("## All winners\n")
L.append("| Year | Project | Prize(s) exactly as listed | What it does (Devpost tagline) | Devpost | GitHub |")
L.append("|---|---|---|---|---|---|")
for r in d:
    tag=r["tagline"][:160]+("..." if len(r["tagline"])>160 else "")
    name=r["name"]
    if name=="Test Project": name="Test Project (not verified as a real project; looks like a Devpost test entry, listed with a raffle prize)"
    L.append(f"| {r['year']} | {esc(name)} | {esc('; '.join(r['prizes']))} | {esc(tag)} | {r['url']} | {r['github'][0] if r['github'] else 'none shown'} |")
open("../treehacks_winners.md","w",encoding="utf-8").write("\n".join(L)+"\n")
print(len(L))
