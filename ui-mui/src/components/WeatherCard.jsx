import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

// Same query as farm-hand/laptop/feeds.py (FIU, next 24 h). Display only: the sim's decisions don't use it.
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=25.7566&longitude=-80.3740&forecast_hours=24'
  + '&hourly=precipitation_probability,precipitation,temperature_2m&timezone=America/New_York';

function useForecast() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const load = () => fetch(URL)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => {
        const h = j.hourly;
        if (!alive) return;
        setState({ status: 'ok', time: h.time, chance: h.precipitation_probability, mm: h.precipitation, temp: h.temperature_2m });
      })
      .catch(() => alive && setState({ status: 'offline' }));
    load();
    const id = setInterval(load, 15 * 60 * 1000);   // feeds.py caches for 15 min too
    return () => { alive = false; clearInterval(id); };
  }, []);
  return state;
}

const hourFmt = new Intl.DateTimeFormat([], { hour: 'numeric' });

function Num({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="p">{label}</Typography>
      <Typography variant="data" sx={{ fontSize: '1rem' }}>{children}</Typography>
    </Box>
  );
}

// Tier 4 (PLAN 5d): outside data, so it sits small at the bottom of the right column, on a rule, not in a card.
export default function WeatherCard() {
  const f = useForecast();
  const ok = f.status === 'ok';
  const rain = ok ? f.mm.reduce((s, v) => s + (v || 0), 0) : null;
  const maxChance = ok ? Math.max(...f.chance.map((v) => v || 0)) : null;

  return (
    <Box component="section" aria-labelledby="sky-title">
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h3" component="h2" id="sky-title">FIU weather, next 24 h</Typography>
        <Typography variant="caption" color="text.secondary">
          {ok ? 'Open-Meteo' : f.status === 'loading' ? 'Loading' : 'Forecast unavailable'}
        </Typography>
      </Stack>

      {ok && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'auto auto 1fr', sm: 'auto auto auto minmax(96px, 1fr)' }, columnGap: 3, rowGap: 1, alignItems: 'end', mt: 1 }}>
          <Num label="Air">{f.temp[0].toFixed(1)} °C</Num>
          <Num label="Rain">{rain.toFixed(1)} mm</Num>
          <Num label="Peak chance">{maxChance}%</Num>
          {/* 24 bars, one per hour: neutral ink, opacity from the chance, no track (taste-skill 9.F). */}
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }} role="img" aria-label={`Rain chance by hour for the next 24 hours, highest ${maxChance}%.`}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px', alignItems: 'end', height: 28 }}>
              {/* A 15% floor so a dry day reads as low bars, not a broken dashed rule. */}
              {f.chance.map((c, i) => (
                <Box key={i} sx={{ height: `${Math.max(15, c || 0)}%`, bgcolor: 'text.secondary', opacity: 0.35 + 0.65 * ((c || 0) / 100), borderRadius: '1px 1px 0 0' }} />
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', mt: 0.25 }}>
              {[0, 12].map((i) => (
                <Typography key={i} variant="caption" color="text.secondary">{hourFmt.format(new Date(f.time[i]))}</Typography>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      <Typography variant="body2" sx={{ mt: 1.5 }}>
        Indoors, so rain doesn't count here. <Link href="#/sim" color="inherit" underline="always">Outside</Link>, Farm Hand waits for it.
      </Typography>
    </Box>
  );
}
