import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Link from '@mui/material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import { CFG } from '../sim.js';
import BaselineSlider from '../components/BaselineSlider.jsx';

/*
 * Simulation (PLAN 5e). Part 1, the season replay, needs laptop/static/sim_data.json, which isn't generated yet,
 * so it shows an honest empty state with the team's recorded totals. Part 2, crops at a moisture level,
 * is computed here from FAO-56 Table 22.
 */

// farm-hand/laya/data/eval.md, run 2026-09-23 on the team's GPU. Quoted, not recomputed here.
// color: timer orange, Laya blue (the AI), rules and the oracle in ink (neither is the product or the timer).
const EVAL = [
  { key: 'timer', brain: 'Timer', how: '5.29 mm every morning, sized for the hottest month', mm: 3316.8, gal: 3545691, stress: 12, drain: 3181.2, color: 'timer.main' },
  { key: 'rules', brain: 'Rules', how: 'soil probe + if-statements', mm: 1419.7, gal: 1517632, stress: 10, drain: 1284.1, color: 'text.secondary' },
  { key: 'laya', brain: 'Laya (Farm Hand)', how: 'soil probe + the trained classifier', mm: 1452.8, gal: 1553052, stress: 0, drain: 1317.2, color: 'primary.main' },
  { key: 'oracle', brain: 'Oracle', how: 'knows the real rain in advance; the ceiling, not a real option', mm: 1415.2, gal: 1512888, stress: 0, drain: 1279.6, color: 'text.disabled', ceiling: true },
];
const BY = Object.fromEntries(EVAL.map((r) => [r.key, r]));
const lessThanTimer = (r) => (1 - r.mm / BY.timer.mm) * 100;
// eval.md section 1: held-out accuracy on 7,524 decisions; wait_rain 161 of 240 right
const ACC = { overall: 94.1, waitRain: (161 / 240) * 100 };

const f1 = (x) => x.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// One labeled bar per brain. Bars are drawn to the largest value in the set; the number is always printed.
function Bars({ label, unit, field, digits = 1 }) {
  const max = Math.max(...EVAL.map((r) => r[field]));
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Typography variant="subtitle2" component="figcaption" sx={{ mb: 1 }}>{label}</Typography>
      <Stack spacing={0.75}>
        {EVAL.map((r) => (
          <Box key={r.key} sx={{ display: 'grid', gridTemplateColumns: { xs: '64px 1fr auto', sm: '140px 1fr 96px' }, columnGap: 1.5, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: r.key === 'laya' ? 600 : 400 }}>{r.brain.replace(' (Farm Hand)', '')}</Typography>
            <Box sx={{ position: 'relative', height: 12, bgcolor: 'action.hover', borderRadius: 999 }} aria-hidden="true">
              <Box sx={{
                position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, bgcolor: r.ceiling ? 'transparent' : r.color,
                border: r.ceiling && r[field] ? 1 : 0, borderStyle: 'dashed', borderColor: 'text.secondary',
                width: max ? `${Math.max(r[field] / max * 100, r[field] ? 1.5 : 0)}%` : 0,
              }} />
            </Box>
            <Typography variant="data" sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {digits ? f1(r[field]) : r[field]} {unit}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function WhereSavingsComeFrom() {
  const rules = lessThanTimer(BY.rules), laya = lessThanTimer(BY.laya);
  return (
    <Paper variant="outlined" component="section" aria-labelledby="split-title" sx={{ px: { xs: 2, lg: 3 }, py: 2.5 }}>
      <Typography variant="h3" component="h2" id="split-title">Where the savings come from</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, maxWidth: '75ch' }}>
        Four brains watering the same simulated field on the same real weather. Only the brain differs.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        From the team's 2026-09-23 run (<Typography variant="code" sx={{ fontSize: 'inherit' }}>laya/data/eval.md</Typography>), not recomputed here.
        Jan 1 2025 to Sep 19 2026, weather Laya never trained on. FAO-56 bucket, sandy soil, Kc 1.05.
      </Typography>

      <Box sx={{ mt: 2.5, display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, maxWidth: 1040 }}>
        <Bars label="Irrigation used" unit="mm" field="mm" />
        <Bars label="Hours past the stress line" unit="h" field="stress" digits={0} />
      </Box>

      <Stack spacing={1.5} sx={{ mt: 3, maxWidth: '80ch' }}>
        <Typography variant="body1">
          <strong>Measuring the soil saves the water.</strong> The rule brain, a soil probe with plain if-statements, used{' '}
          {f1(rules)}% less water than the timer. Laya used {f1(laya)}% less, {f1(BY.laya.mm - BY.rules.mm)} mm more than the rules.
        </Typography>
        <Typography variant="body1">
          <strong>The classifier protects the crop.</strong> Laya was the only real brain that never let the field past the stress line:{' '}
          {BY.laya.stress} hours, against {BY.rules.stress} for the rules and {BY.timer.stress} for the timer. That matches the oracle, which knows the rain ahead of time.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          On held-out decisions Laya picked the right move {f1(ACC.overall)}% of the time. Its weakest move is waiting for rain ({f1(ACC.waitRain)}% right, 161 of 240),
          which depends on the forecast. Indoors there is no rain, so this advantage only shows outside.
        </Typography>
      </Stack>

      <TableContainer sx={{ mt: 2.5, maxWidth: 960 }}>
        <Table size="small" aria-label="Season totals for each brain">
          <TableHead>
            <TableRow>
              <TableCell>Brain</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>What decides</TableCell>
              <TableCell align="right">Irrigation</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Gallons per acre</TableCell>
              <TableCell align="right">Less than the timer</TableCell>
              <TableCell align="right">Hours past the stress line</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Lost below the roots</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {EVAL.map((r) => (
              <TableRow key={r.key}>
                <TableCell sx={{ fontWeight: r.key === 'laya' ? 600 : 400, whiteSpace: 'nowrap' }}>{r.brain}</TableCell>
                <TableCell sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>{r.how}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{f1(r.mm)} mm</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.gal.toLocaleString()}</TableCell>
                <TableCell align="right">{r.key === 'timer' ? '' : `${f1(lessThanTimer(r))}%`}</TableCell>
                <TableCell align="right">{r.stress}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{f1(r.drain)} mm</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, maxWidth: '80ch' }}>
        The timer here waters every day at the hottest month's rate, the way real timers are usually set. A timer tuned to each season would close part of the gap.
        Simulated field on real weather, not a measured farm.
      </Typography>
    </Paper>
  );
}

// FAO-56 Table 22: p = fraction of available water a crop can use before stress. Stress line = 20 + 45 x (1 - p)
// on our scale (wilting point 20%, field capacity 65%).
const CROPS = [
  ['Strawberries', 0.2, '0.2-0.3'],
  ['Bell peppers', 0.3, '0.5-1.0'],
  ['Lettuce', 0.3, '0.3-0.5'],
  ['Potato', 0.35, '0.4-0.6'],
  ['Tomato', 0.4, '0.7-1.5'],
  ['Watermelon', 0.4, '0.8-1.5'],
  ['Green beans', 0.45, '0.5-0.7'],
  ['Citrus (70% canopy)', 0.5, '1.2-1.5'],
  ['Blueberries (berries, bushes)', 0.5, '0.6-1.2'],
  ['Sugarcane', 0.65, '1.2-2.0'],
].map(([name, p, root]) => ({ name, p, root, line: 20 + 45 * (1 - p) }))
  .sort((a, b) => b.line - a.line);

const LO = 20, HI = 65;
const pos = (v) => `${((v - LO) / (HI - LO)) * 100}%`;

function SeasonReplay() {
  return (
    <Paper variant="outlined" component="section" aria-labelledby="replay-title" sx={{ px: { xs: 2, lg: 3 }, py: 2.5 }}>
      <Typography variant="h3" component="h2" id="replay-title">Season replay: a timer vs Farm Hand on 21 months of Miami weather</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Simulated field on real Miami weather: FAO-56 bucket, sandy soil, Kc 1.05. Not a measured farm.
      </Typography>
      <Box sx={{ mt: 2, p: 2, borderRadius: 1, border: 1, borderColor: 'divider', borderStyle: 'dashed' }}>
        <Typography variant="subtitle1">The replay isn't generated yet</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, maxWidth: '70ch' }}>
          It plays from <Typography variant="code" sx={{ fontSize: 'inherit' }}>laptop/static/sim_data.json</Typography>, which{' '}
          <Typography variant="code" sx={{ fontSize: 'inherit' }}>laya/season_replay.py</Typography> builds with the Laya model. That file doesn't exist yet,
          so there is nothing to play. Once it's committed, the timelapse, the cumulative water chart and the "held off for rain" list go here.
        </Typography>
      </Box>

    </Paper>
  );
}

function Crops({ fh, act }) {
  const base = CFG.DRY_PCT;
  return (
    <Paper variant="outlined" component="section" aria-labelledby="crops-title" sx={{ px: { xs: 2, lg: 3 }, py: 2.5 }}>
      <Typography variant="h3" component="h2" id="crops-title">Crops at a moisture level</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, maxWidth: '75ch' }}>
        Pick the level to keep. A crop whose stress line sits above it gets stressed. Different crops tolerate different dryness, so one level can't fit all of them.
      </Typography>

      <Box sx={{ mt: 2, maxWidth: 560 }}>
        <BaselineSlider fh={fh} act={act} label="Keep the soil at" />
        <Typography variant="caption" color="text.secondary" component="p">Same setting as the Live box page: it moves box A's baseline too.</Typography>
      </Box>

      {/* Rows sorted by stress line so healthy / stressed splits at one boundary. The baseline runs through every row. */}
      <Box sx={{ mt: 3, position: 'relative' }}>
        {/* the 20-65% scale, once, above the first row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: '240px minmax(0, 640px) 112px' }, columnGap: 2, mb: 0.5 }} aria-hidden="true">
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Crop, FAO-56 p</Typography>
          <Box sx={{ position: 'relative', height: 16, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            {[20, 35, 50, 65].map((v) => (
              <Typography key={v} variant="caption" color="text.secondary" sx={{ position: 'absolute', left: pos(v), transform: v === 20 ? 'none' : v === 65 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{v}%</Typography>
            ))}
          </Box>
        </Box>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {CROPS.map((c) => {
            const ok = base >= c.line;
            return (
              <Box component="li" key={c.name} sx={{
                display: 'grid', alignItems: 'center', columnGap: 2, rowGap: 0.5, py: 1, borderBottom: 1, borderColor: 'divider',
                gridTemplateColumns: { xs: '1fr auto', sm: '240px minmax(0, 640px) 112px' },
                gridTemplateAreas: { xs: '"name pill" "bar bar"', sm: '"name bar pill"' },
              }}>
                <Box sx={{ gridArea: 'name' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  <Typography variant="caption" color="text.secondary">stress line {c.line.toFixed(1)}%, p {c.p.toFixed(2)}, roots {c.root} m</Typography>
                </Box>
                <Box sx={{ gridArea: 'bar', position: 'relative', height: 20 }} aria-hidden="true">
                  <Box sx={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, bgcolor: 'divider' }} />
                  <Box sx={{ position: 'absolute', top: 2, bottom: 2, width: 2, bgcolor: 'text.primary', left: pos(c.line) }} />
                  <Box sx={{ position: 'absolute', top: -8, bottom: -8, width: '1px', bgcolor: 'text.secondary', left: pos(base) }} />
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ gridArea: 'pill', alignItems: 'center', justifySelf: { xs: 'end', sm: 'start' },
                  px: 1, py: 0.25, borderRadius: 999, border: 1, borderColor: ok ? 'success.text' : 'text.primary', color: ok ? 'success.text' : 'text.primary' }}>
                  {ok ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <BlockIcon sx={{ fontSize: 16 }} />}
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{ok ? 'healthy' : 'stressed'}</Typography>
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Typography variant="body2" sx={{ mt: 2 }}>
        At {base}%, {CROPS.filter((c) => base >= c.line).length} of {CROPS.length} crops stay healthy.
        {CROPS[0].line > CFG.WET_PCT - 15 ? ` ${CROPS[0].name} need ${CROPS[0].line.toFixed(0)}%, above this box's highest baseline (${CFG.WET_PCT - 15}%).` : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, maxWidth: '80ch' }}>
        Stress line = 20 + 45 × (1 − p) on our scale (wilting point 20%, field capacity 65%), with p from{' '}
        <Link href="https://www.fao.org/4/x0490e/x0490e0e.htm" target="_blank" rel="noreferrer">FAO-56, Table 22</Link>. The 1px line is the level you picked; the 2px tick is each crop's stress line.
        No water numbers per crop until each crop's Kc (FAO-56 Table 12) is looked up and cited.
      </Typography>
    </Paper>
  );
}

export default function SimPage({ fh, act }) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '1.75rem', lg: '2rem' } }}>Outside, it waits for the rain</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Everything on this page is a simulated field on real Miami weather, not a measured farm.
        </Typography>
      </Box>
      <SeasonReplay />
      <WhereSavingsComeFrom />
      <Crops fh={fh} act={act} />
    </Stack>
  );
}
