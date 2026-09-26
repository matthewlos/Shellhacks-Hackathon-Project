import { useEffect, useState } from 'react';
import { brand } from './brand';
import * as backend from './data/backendBoard';
import { useApp } from './data/store';
import { FieldCanvas } from './scene/FieldCanvas';
import { BoxCard } from './ui/Boxes';
import { CropsPage } from './ui/Crops';
import { Forecast } from './ui/Forecast';
import { History } from './ui/History';
import { LayaCall } from './ui/LayaCall';
import { RegionPage } from './ui/Region';
import { TopBar, type Page } from './ui/TopBar';

const BACKEND_URL = (backend as unknown as { BACKEND_URL?: string }).BACKEND_URL ?? 'the Mac mini';

/** Shown until the first message from the Mac mini arrives. No data is ever simulated. */
function Waiting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const id = setTimeout(() => setSlow(true), 2500); return () => clearTimeout(id); }, []);
  return (
    <main className="waiting">
      <h1>{brand.name}</h1>
      <p>{slow ? 'Still waiting for the Mac mini. This page connects by itself as soon as it answers.' : 'Connecting to the Mac mini.'}</p>
      {slow && <p className="small muted">Looking for it at <span className="mono">{BACKEND_URL}</span></p>}
    </main>
  );
}

const PAGES: Page[] = ['live', 'crops', 'region'];
const fromHash = (): Page => { const h = location.hash.slice(1) as Page; return PAGES.includes(h) ? h : 'live'; };

/** The page lives in the URL hash (#crops, #region) so a tab can be linked and survives a reload. */
function usePage(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(fromHash);
  useEffect(() => { const on = () => setPage(fromHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return [page, (p) => { history.replaceState(null, '', p === 'live' ? location.pathname + location.search : '#' + p); setPage(p); }];
}

export function App() {
  const [page, setPage] = usePage();
  const ready = useApp((s) => s.ready);
  const stage = useApp((s) => s.stage);
  const replaying = useApp((s) => s.replay.active);

  // Farm Hand has no onboarding: the boxes are set up on the bench. Go straight to the live view.
  useEffect(() => { if (ready && stage !== 'live') useApp.setState({ stage: 'live', draft: null }); }, [ready, stage]);

  if (!ready) return <Waiting />;
  return (
    <div className={`app page-${page} ${replaying ? 'is-replay' : ''}`}>
      <TopBar page={page} onPage={setPage} />
      {page === 'live' && (
        <>
          <div className="scene" aria-label="The two boxes in 3D">
            <FieldCanvas />
          </div>
          <div className="boxes">
            <BoxCard id="A" />
            <BoxCard id="B" />
          </div>
          <History />
          <aside className="side">
            <LayaCall />
            <Forecast />
          </aside>
        </>
      )}
      {page === 'crops' && <CropsPage />}
      {page === 'region' && <RegionPage />}
      <p className="credit">{brand.credit}.</p>
    </div>
  );
}
