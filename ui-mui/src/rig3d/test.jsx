// Test bench for the 3D rig (dev only: http://localhost:5173/src/rig3d/test.html). Not part of the app build.
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import '@fontsource-variable/public-sans/wght.css';
import { theme } from '../theme.js';
import { useFarmHand, sim } from '../useFarmHand.js';
import Rig from '../components/Rig.jsx';

const Rig3D = lazy(() => import('./Rig3D.jsx'));
window.__sim = sim;
const BOTH = new URLSearchParams(location.search).has('both');

function Bench() {
  const { fh } = useFarmHand();
  const rig2d = <Rig fh={fh} />;
  return (
    <Box sx={{ maxWidth: 1520, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: { xs: '4 / 3', md: '16 / 9' }, maxHeight: { md: '60vh' } }}>
        <Suspense fallback={rig2d}><Rig3D fh={fh} fallback={rig2d} /></Suspense>
      </Box>
      {BOTH && <Box id="rig2d" sx={{ mt: 2, maxWidth: 900 }}><Rig fh={fh} /></Box>}
    </Box>
  );
}
createRoot(document.getElementById('root')).render(<ThemeProvider theme={theme}><CssBaseline /><Bench /></ThemeProvider>);
