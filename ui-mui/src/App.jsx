import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme.js';
import { useFarmHand } from './useFarmHand.js';
import { useHashRoute } from './useHashRoute.js';
import TopBar from './components/TopBar.jsx';
import { Page } from './components/Page.jsx';
import LivePage from './pages/LivePage.jsx';
import DemoPage from './pages/DemoPage.jsx';
import ControlPage from './pages/ControlPage.jsx';
import SimPage from './pages/SimPage.jsx';

// Four pages, one header. Live is the real box A; the sim keeps running for Demo, Vs timer and Outside
// whichever page is open. Header and main share one container (<Page>), so they share one left edge.
export default function App() {
  const sim = useFarmHand();
  const route = useHashRoute();
  const { fh, act, frac } = sim;
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TopBar {...sim} route={route} />
      <Page component="main" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 6, md: 8 } }}>
        {route === '/' && <LivePage />}
        {route === '/demo' && <DemoPage fh={fh} act={act} frac={frac} />}
        {route === '/control' && <ControlPage fh={fh} act={act} frac={frac} />}
        {route === '/sim' && <SimPage fh={fh} act={act} />}
      </Page>
    </ThemeProvider>
  );
}
