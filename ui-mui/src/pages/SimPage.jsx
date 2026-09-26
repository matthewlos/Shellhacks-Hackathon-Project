import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Link from '@mui/material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import { CFG } from '../sim.js';
import { grid12 } from '../components/Page.jsx';
import BaselineSlider from '../components/BaselineSlider.jsx';
import Scatter from '../components/Scatter.jsx';
import WeatherCard from '../components/WeatherCard.jsx';
import { useSimValue } from '../useFarmHand.js';

/*
 * Outside: one argument, one chart. The scatter puts water on x and stress on y, so Farm Hand's real edge
 * (0 hours) and its real place on water (next to plain rules) are both visible. The table sits in a closed
 * "All numbers" accordion; the forecast and the crops ruler follow. Everything spans the 12-column grid.
 */

// farm-hand/laya/data/eval.md, run 2026-09-23 (section 2 table). Quoted, not recomputed.
const EVAL = [
  { key: 'timer', name: 'Timer', how: '5.29 mm daily, hottest-month rate', mm: 3316.8, gal: 3545691, stress: 12, drain: 3181.2 },
  { key: 'rules', name: 'Rules', how: 'probe + fixed rules', mm: 1419.7, gal: 1517632, stress: 10, drain: 1284.1 },
  { key: 'laya', name: 'Farm Hand', how: 'probe + Laya', mm: 1452.8, gal: 1553052, stress: 0, drain: 1317.2 },
  { key: 'oracle', name: 'Best case', how: 'knows the rain ahead; not possible', mm: 1415.2, gal: 1512888, stress: 0, drain: 1279.6 },
];
const BY = Object.fromEntries(EVAL.map((r) => [r.key, r]));
// Derived from the quoted mm; for Farm Hand this reproduces eval.md's own "56.2% less irrigation".
const lessThanTimer = (r) => (1 - r.mm / BY.timer.mm) * 100;
// eval.md section 1: accuracy 0.941; wait_rain 161/240 (0.671).
const ACC = { overall: '94.1', waitRain: '67.1' };

const f1 = (x) => x.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hours = (n) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

// "Saved as much water" is only honest while rules and Farm Hand are within 3 points of each other.
const SAME_WATER = Math.abs(lessThanTimer(BY.rules) - lessThanTimer(BY.laya)) <= 3;

const full = '1 / -1';
const eight = { xs: full, md: '1 / span 8' };

function AllNumbers() {
  const sm = { display: { xs: 'none', sm: 'table-cell' } };
  return (
    <Accordion disableGutters sx={{ gridColumn: full, mt: 3 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="all-numbers" id="all-numbers-head">
        <Typography variant="subtitle2" component="span">All numbers</Typography>
      </AccordionSummary>
      <AccordionDetails id="all-numbers">
        <TableContainer>
          <Table size="small" aria-label="Season totals by method">
            <TableHead>
              <TableRow>
                <TableCell>Method</TableCell>
                <TableCell sx={sm}>How</TableCell>
                <TableCell align="right">Water (mm)</TableCell>
                <TableCell align="right" sx={sm}>Gal/acre</TableCell>
                <TableCell align="right">Saved vs timer</TableCell>
                <TableCell align="right">Stress (h)</TableCell>
                <TableCell align="right" sx={sm}>Drained (mm)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {EVAL.map((r) => {
                const hi = r.key === 'laya' ? { bgcolor: 'wash', '& td': { fontWeight: 600 } } : null;
                return (
                  <TableRow key={r.key} sx={hi}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.name}</TableCell>
                    <TableCell sx={{ ...sm, color: 'text.secondary' }}>{r.how}</TableCell>
                    <TableCell align="right">{f1(r.mm)}</TableCell>
                    <TableCell align="right" sx={sm}>{r.gal.toLocaleString()}</TableCell>
                    <TableCell align="right">{r.key === 'timer' ? '-' : `${f1(lessThanTimer(r))}%`}</TableCell>
                    <TableCell align="right">{r.stress}</TableCell>
                    <TableCell align="right" sx={sm}>{f1(r.drain)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="body2" sx={{ mt: 2, maxWidth: '60ch' }}>
          On held-out weather Laya picked the best move {ACC.overall}% of the time; {ACC.waitRain}% of the time when the right call was to wait for rain.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, maxWidth: '60ch' }}>
          Timer set for the hottest month, as most are. A seasonal timer would close part of the gap. FAO-56 bucket, sandy soil, Kc 1.05.
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

// FAO-56 Table 22, as quoted in PLAN.md 5e (checked 2026-09-26 at fao.org/4/x0490e/x0490e0e.htm):
// p = fraction of available water a crop can use before stress; stress line = 20 + 45 x (1 - p) on our scale
// (wilting point 20%, field capacity 65%). Citrus is the 70% canopy row; blueberries use "berries, bushes".
// `shown` is the table's own stress-line figure, printed as is.
const CROPS = [
  ['Strawberries', 0.2, '56.0'], ['Bell peppers', 0.3, '51.5'], ['Lettuce', 0.3, '51.5'], ['Potato', 0.35, '49.3'],
  ['Tomato', 0.4, '47.0'], ['Watermelon', 0.4, '47.0'], ['Green beans', 0.45, '44.8'], ['Citrus', 0.5, '42.5'],
  ['Blueberries', 0.5, '42.5'], ['Sugarcane', 0.65, '35.8'],
].map(([name, p, shown]) => ({ name, p, shown, line: 20 + 45 * (1 - p) }))
  .sort((a, b) => b.line - a.line);

// One coordinate for the ruler, the needle and every row's stress tick.
const DOMAIN = [20, 65];
const pos = (v) => `${((v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100}%`;

// The ruler and the rows share one set of columns (subgrid), so the single needle can run through all of them.
const COLS = {
  xs: 'minmax(0, 1fr) auto',
  sm: '160px minmax(0, 1fr) 96px',
  md: grid12.gridTemplateColumns.md,
};
const BAR = { xs: full, sm: '2', md: '3 / span 8' };
const NAME = { sm: '1', md: '1 / span 2' };
const STATE = { sm: '3', md: '11 / span 2' };
const sub = { display: 'grid', gridColumn: full, gridTemplateColumns: 'subgrid' };

function Crops({ fh, act }) {
  const base = useSimValue(() => CFG.DRY_PCT, 4);
  const hi = CFG.WET_PCT - 15;
  const healthy = CROPS.filter((c) => base >= c.line).length;
  const top = CROPS[0];
  return (
    <Box component="section" aria-labelledby="crops-title" sx={{ gridColumn: full, mt: 6 }}>
      <Typography variant="h3" id="crops-title">Which crops fit</Typography>
      <Typography variant="status" sx={{ mt: 2 }} aria-live="polite">
        {healthy} of {CROPS.length} crops healthy at {base}%.
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5, maxWidth: '60ch' }}>
        {top.name} need {top.shown}%{top.line > hi ? `, above this box's ${hi}% max` : ''}.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: COLS, columnGap: { xs: 2, sm: 3, md: 4 }, mt: 3 }}>
        <Box sx={{ ...sub, gridRow: 1 }}>
          <BaselineSlider fh={fh} act={act} layout="ruler" domain={DOMAIN} sx={{ gridColumn: BAR }} />
        </Box>

        <Box component="ul" aria-label="Crops by stress line" sx={{ ...sub, gridRow: 2, listStyle: 'none', m: 0, p: 0, mt: 1 }}>
          {CROPS.map((c) => {
            const ok = base >= c.line;
            return (
              <Box component="li" key={c.name} sx={{
                ...sub, alignItems: 'center', py: 0.5,
                gridTemplateAreas: { xs: '"name state" "bar bar"', sm: 'none' },
              }}>
                <Typography variant="body2" sx={{ gridArea: { xs: 'name', sm: 'auto' }, gridColumn: NAME, fontWeight: ok ? 600 : 400 }}>{c.name}</Typography>
                <Box aria-hidden="true" sx={{ gridArea: { xs: 'bar', sm: 'auto' }, gridColumn: BAR, gridRow: { sm: 1 }, position: 'relative', height: 20 }}>
                  <Box sx={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, bgcolor: 'divider' }} />
                  <Box sx={{ position: 'absolute', top: 2, height: 16, width: 2, ml: '-1px', bgcolor: ok ? 'success.text' : 'text.primary', left: pos(c.line) }} />
                  {/* Phones: the rows are two lines, so the needle is drawn per bar instead of through the names. */}
                  <Box sx={{ display: { xs: 'block', sm: 'none' }, position: 'absolute', top: -4, bottom: -4, width: '1px', ml: '-0.5px', bgcolor: 'text.primary', left: pos(base) }} />
                </Box>
                <Typography variant="data" component="p" sx={{
                  gridArea: { xs: 'state', sm: 'auto' }, gridColumn: STATE, gridRow: { sm: 1 }, textAlign: 'right', whiteSpace: 'nowrap',
                  display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5,
                  color: ok ? 'success.text' : 'text.primary',
                }}>
                  {ok ? <><CheckIcon sx={{ fontSize: 16 }} aria-hidden="true" />healthy</> : `needs ${c.shown}%`}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* The minimum: one 1px ink line from the ruler down through every row (sm and up). */}
        <Box aria-hidden="true" sx={{ display: { xs: 'none', sm: 'block' }, gridColumn: BAR, gridRow: '1 / span 2', position: 'relative', pointerEvents: 'none' }}>
          {/* starts under the ruler's labels (its box is 64 px tall), so it never strikes through "35" */}
          <Box sx={{ position: 'absolute', top: 64, bottom: 0, width: '1px', ml: '-0.5px', bgcolor: 'text.primary', left: pos(base) }} />
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2, maxWidth: '60ch' }}>
        Stress line = 20 + 45 × (1 − p), p from{' '}
        <Link href="https://www.fao.org/4/x0490e/x0490e0e.htm" target="_blank" rel="noreferrer">FAO-56 Table 22</Link>.
      </Typography>
    </Box>
  );
}

export default function SimPage({ fh, act }) {
  const rules = lessThanTimer(BY.rules), laya = lessThanTimer(BY.laya);
  return (
    <Box sx={{ ...grid12, rowGap: 0 }}>
      <Box sx={{ gridColumn: full }}>
        <Typography variant="h2">Outside: 21 months of Miami weather</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Simulated field on real Miami weather, Jan 2025 to Sep 2026. Not a measured farm.
        </Typography>
      </Box>

      <Typography variant="headline" sx={{ gridColumn: eight, mt: 6 }}>
        Farm Hand used {f1(laya)}% less water than a timer, and the crop spent {hours(BY.laya.stress)} past the stress line.
      </Typography>

      <Scatter points={EVAL} sx={{ gridColumn: eight, mt: 3 }} />

      <Box sx={{ gridColumn: { xs: full, md: '9 / -1' }, alignSelf: 'end', mt: { xs: 2, md: 0 }, pb: { md: 6 } }}>
        <Typography variant="body1" sx={{ maxWidth: '60ch' }}>
          {SAME_WATER
            ? `Plain rules on the probe saved as much water, but the crop spent ${hours(BY.rules.stress)} past the stress line.`
            : `Plain rules on the probe saved ${f1(rules)}% vs Farm Hand's ${f1(laya)}%, but the crop spent ${hours(BY.rules.stress)} past the stress line.`}
          {' '}Laya kept it at {BY.laya.stress}, the same as the best case.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, maxWidth: '60ch' }}>
          Team run, 2026-09-23 (<Typography variant="code">eval.md</Typography>), on weather Laya never trained on.
        </Typography>
      </Box>

      <AllNumbers />
      <WeatherCard sx={{ gridColumn: full, mt: 6 }} />
      <Crops fh={fh} act={act} />
    </Box>
  );
}
