import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { theme } from './theme.js';
import { useFarmHand } from './useFarmHand.js';
import { useHashRoute } from './useHashRoute.js';
import TopBar from './components/TopBar.jsx';
import LivePage from './pages/LivePage.jsx';
import ControlPage from './pages/ControlPage.jsx';
import SimPage from './pages/SimPage.jsx';

// Three pages, one header (PLAN 5e). The sim keeps running whichever page is open.
export default function App() {
  const sim = useFarmHand();
  const route = useHashRoute();
  const { fh, act, frac } = sim;
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TopBar {...sim} route={route} />
      <Box component="main" sx={{ maxWidth: 1880, mx: 'auto', px: { xs: 2, md: 3 }, pt: 2, pb: 4 }}>
        {route === '/' && <LivePage fh={fh} act={act} frac={frac} />}
        {route === '/control' && <ControlPage fh={fh} act={act} frac={frac} />}
        {route === '/sim' && <SimPage fh={fh} act={act} />}
      </Box>
    </ThemeProvider>
  );
}
