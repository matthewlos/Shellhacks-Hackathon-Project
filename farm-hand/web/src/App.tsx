import { useCallback, useEffect, useState } from 'react';
import { brand } from './brand';
import * as backend from './data/backendBoard';
import { useApp } from './data/store';
import { FieldCanvas } from './scene/FieldCanvas';
import { Dock, Panels, usePanel } from './ui/Dock';
import { TopBar } from './ui/TopBar';

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

/** The 3D boxes fill the screen; everything else opens from the dock as a panel over them. */
export function App() {
  const ready = useApp((s) => s.ready);
  const stage = useApp((s) => s.stage);
  const replaying = useApp((s) => s.replay.active);
  const [open, setOpen] = usePanel();
  const close = useCallback(() => setOpen(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Farm Hand has no onboarding: the boxes are set up on the bench. Go straight to the live view.
  useEffect(() => { if (ready && stage !== 'live') useApp.setState({ stage: 'live', draft: null }); }, [ready, stage]);
  // History feeds the chart and the "Saves" numbers, so load it even while its panel is closed.
  useEffect(() => {
    if (!ready) return;
    const load = () => { if (!useApp.getState().replay.active) void useApp.getState().openHistory(36).catch(() => {}); };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [ready]);

  if (!ready) return <Waiting />;
  return (
    <div className={`app ${replaying ? 'is-replay' : ''} ${open ? 'has-panel' : ''}`}>
      <div className="scene" aria-label="The two boxes in 3D">
        <FieldCanvas />
      </div>
      <TopBar />
      <Panels open={open} onClose={close} />
      <Dock open={open} onToggle={setOpen} />
    </div>
  );
}
