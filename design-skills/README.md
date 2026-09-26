# Design skills

The design skills Dechante uses for every page, dashboard and demo UI. They're Claude Code skills: each folder with a `SKILL.md` teaches the agent one part of design.

## Install (Claude Code)

Copy the ones you want into your skills folder, then restart Claude Code:

```bash
cp -R design-skills/taste-skill design-skills/impeccable design-skills/frontend-design ~/.claude/skills/
cp -R design-skills/emil-kowalski/skills/* ~/.claude/skills/
```

Or just tell the agent: "read design-skills/<folder>/SKILL.md and apply it."

## What's here, in the order to reach for them

| Folder | What it's for | Source · license |
|---|---|---|
| `taste-skill/` | Anti-slop frontend taste: reads the brief, picks a direction, avoids templated looks. Start here. | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| `impeccable/` | Critique, polish, audit and harden any UI: hierarchy, type, spacing, color, motion, states. | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) · Apache 2.0 |
| `frontend-design/` | Distinctive visual direction for new UI. | [anthropics/skills](https://github.com/anthropics/skills) · see its LICENSE.txt |
| `emil-kowalski/` | UI polish and motion: `emil-design-eng` (read it in full), `animate`, `review-animations`, `improve-animations`. | [emilkowalski/skills](https://github.com/emilkowalski/skills) · MIT |
| `mengto/` | Meng To's 140+ skills. Web-design set: glass/dark UI, framed grids, border gradients, shadows, number details, awwwards-quality sites. Preview images removed to keep the repo small; see the source repo for them. | [MengTo/Skills](https://github.com/MengTo/Skills) · MIT |
| `owl-listener-designer-skills/` | 100+ fundamentals: layout, spacing, type, color, tokens, theming, responsive, states, `critique-*`, and the UX laws (Miller, Hick, Fitts, Doherty, Jakob…). | [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) · MIT |
| `diagram-design/` | Clean flowcharts and pipeline diagrams: orthogonal connectors, one focal node, 4px grid. | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) · MIT |

## For the Farm Hand dashboard

The combo that worked on past dashboards: **taste-skill** for direction, **Owl-Listener** `critique-information-density` + `millers-law` for chunking, **emil-design-eng** for motion, **impeccable** for the final polish pass. Skin everything to the dashboard's own tokens; don't let a skill's default palette override the house look.

Each folder keeps its original LICENSE. All credit to the authors.
