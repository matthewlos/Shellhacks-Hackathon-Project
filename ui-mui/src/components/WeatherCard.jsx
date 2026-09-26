import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { grid12 } from './Page.jsx';

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
const Num = ({ children }) => <Box component="span" sx={{ typography: 'data', fontSize: '1rem', lineHeight: 'inherit' }}>{children}</Box>;

// "Next 24 h at FIU" on Outside (moved from Live: rain only matters outdoors). A sentence on the left half,
// 24 hourly rain-chance bars on the right half, on the page's 12-column grid.
export default function WeatherCard({ sx }) {
  const f = useForecast();
  const ok = f.status === 'ok';
  const rain = ok ? f.mm.reduce((s, v) => s + (v || 0), 0) : null;
  const maxChance = ok ? Math.max(...f.chance.map((v) => v || 0)) : null;
  const half = { xs: '1 / -1', md: '1 / span 6' };

  return (
    <Box component="section" aria-labelledby="sky-title" sx={{ ...grid12, rowGap: 0, alignItems: 'start', ...sx }}>
      <Typography variant="h3" id="sky-title" sx={{ gridColumn: '1 / -1', mb: 2 }}>Next 24 h at FIU</Typography>

      <Typography variant="body1" sx={{ gridColumn: half, maxWidth: '60ch' }}>
        {ok
          ? <><Num>{f.temp[0].toFixed(1)} °C</Num> now, <Num>{rain.toFixed(1)} mm</Num> of rain, at most <Num>{maxChance}%</Num> chance.</>
          : f.status === 'loading' ? 'Loading forecast.' : 'Forecast offline.'}
      </Typography>

      {ok && (
        // One bar per hour: neutral ink, opacity from the chance, a 15% floor so a dry day reads as low bars.
        <Box role="img" aria-label={`Rain chance by hour for the next 24 hours, highest ${maxChance}%.`}
          sx={{ gridColumn: { xs: '1 / -1', md: '7 / -1' }, gridRow: { md: '2 / span 2' }, mt: { xs: 2, md: 0 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: '2px', alignItems: 'end', height: 40 }}>
            {f.chance.map((c, i) => (
              <Box key={i} sx={{ height: `${Math.max(15, c || 0)}%`, bgcolor: 'text.secondary', opacity: 0.35 + 0.65 * ((c || 0) / 100), borderRadius: '1px 1px 0 0' }} />
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', mt: 0.5 }}>
            {[0, 6, 12, 18].map((i) => (
              <Typography key={i} variant="caption" color="text.secondary">{f.time[i] ? hourFmt.format(new Date(f.time[i])) : ''}</Typography>
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" component="p" sx={{ gridColumn: half, mt: 1, maxWidth: '60ch' }}>
        Open-Meteo. Outdoors, Farm Hand holds off when rain is coming.
      </Typography>
    </Box>
  );
}
