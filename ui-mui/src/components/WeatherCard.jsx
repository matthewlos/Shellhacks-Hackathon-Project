import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

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
        setState({
          status: 'ok',
          time: h.time, chance: h.precipitation_probability, mm: h.precipitation, temp: h.temperature_2m,
          fetched: new Date(),
        });
      })
      .catch(() => alive && setState({ status: 'offline' }));
    load();
    const id = setInterval(load, 15 * 60 * 1000);   // feeds.py caches for 15 min too
    return () => { alive = false; clearInterval(id); };
  }, []);
  return state;
}

const hourFmt = new Intl.DateTimeFormat([], { hour: 'numeric' });

export default function WeatherCard() {
  const f = useForecast();
  const ok = f.status === 'ok';
  const rain = ok ? f.mm.reduce((s, v) => s + (v || 0), 0) : null;
  const maxChance = ok ? Math.max(...f.chance.map((v) => v || 0)) : null;

  return (
    <Paper variant="outlined" component="section" aria-labelledby="sky-title" sx={{ px: { xs: 2, lg: 3 }, py: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h3" id="sky-title">Weather at FIU, next 24 h</Typography>
        <Typography variant="caption" color="text.secondary">
          {ok ? 'Open-Meteo, live' : f.status === 'loading' ? 'Open-Meteo, loading' : 'Forecast offline'}
        </Typography>
      </Stack>

      {ok ? (
        <>
          <Stack direction="row" useFlexGap sx={{ gap: { xs: 2, sm: 4 }, mt: 1.5, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Air now</Typography>
              <Typography variant="readout">{f.temp[0].toFixed(1)}<Typography variant="unit" component="span">{' '}°C</Typography></Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Rain, 24 h</Typography>
              <Typography variant="readout">{rain.toFixed(1)}<Typography variant="unit" component="span">{' '}mm</Typography></Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Highest chance</Typography>
              <Typography variant="readout">{maxChance}<Typography variant="unit" component="span">%</Typography></Typography>
            </Box>
          </Stack>

          {/* 24 bars, one per hour: neutral ink, opacity from the chance. No track behind them (taste-skill 9.F). */}
          <Box sx={{ mt: 1.5 }} role="img" aria-label={`Rain chance by hour for the next 24 hours, highest ${maxChance}%.`}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px', alignItems: 'end', height: 36 }}>
              {f.chance.map((c, i) => (
                <Box key={i} sx={{ height: `${Math.max(4, c || 0)}%`, bgcolor: 'text.secondary', opacity: 0.35 + 0.65 * ((c || 0) / 100), borderRadius: '2px 2px 0 0' }} />
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', mt: 0.5 }}>
              {[0, 6, 12, 18].map((i) => (
                <Typography key={i} variant="caption" color="text.secondary">{hourFmt.format(new Date(f.time[i]))}</Typography>
              ))}
            </Box>
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {f.status === 'loading' ? 'Asking Open-Meteo for the next 24 hours.' : "Couldn't reach Open-Meteo. The box doesn't need it: it's indoors."}
        </Typography>
      )}

      <Typography variant="body2" sx={{ mt: 2 }}>
        This box is indoors, so rain can't reach it. Farm Hand won't hold off for rain here.
      </Typography>
    </Paper>
  );
}
