/**
 * "Listen": the farm's status read aloud. The server writes the sentence from the latest reading and decision and
 * voices it with ElevenLabs (POST /farmhand/api/speak -> MP3). Without a key it answers 503 with the sentence, and the
 * browser's own voice (speechSynthesis) reads it instead, with the words shown as a caption.
 *
 * iOS only lets audio start inside the tap itself, and the MP3 arrives after a network round trip. So the tap plays a
 * silent clip on the one reusable <audio> element (and an empty utterance) to unlock both; the real clip then plays
 * on that same element once it arrives.
 */
import { useEffect, useRef, useState } from 'react';
import * as backend from '../data/backendBoard';
import './listen.css';

const BASE = (backend as unknown as { BACKEND_URL?: string }).BACKEND_URL ?? '/farmhand';
const CAPTION_HOLD_MS = 6000;

type Phase = 'idle' | 'loading' | 'playing';
type Caption = { text: string; note?: string };

/** A 50 ms silent WAV, built once, used to unlock the audio element inside the tap. */
let silentUrl: string | null = null;
function silence(): string {
  if (silentUrl) return silentUrl;
  const n = 400, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

export function Listen() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [caption, setCaption] = useState<Caption | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const clip = useRef<string | null>(null);
  const hide = useRef<number | undefined>(undefined);
  const run = useRef(0);                               // bumps on every start/stop so late callbacks from an old run are ignored

  const holdCaption = () => { window.clearTimeout(hide.current); hide.current = window.setTimeout(() => setCaption(null), CAPTION_HOLD_MS); };
  const freeClip = () => { if (clip.current) { URL.revokeObjectURL(clip.current); clip.current = null; } };

  const stop = () => {
    run.current++;
    abort.current?.abort();
    const a = audio.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    synth()?.cancel();
    freeClip();
    setPhase('idle');
    holdCaption();
  };

  useEffect(() => () => { run.current++; abort.current?.abort(); audio.current?.pause(); synth()?.cancel(); freeClip(); window.clearTimeout(hide.current); }, []);

  const speakInBrowser = (id: number, text: string, note: string) => {
    setCaption({ text, note });
    const s = synth();
    if (!s) { setPhase('idle'); holdCaption(); return; }
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1;
    u.onend = u.onerror = () => { if (run.current === id) { setPhase('idle'); holdCaption(); } };
    setPhase('playing');
    s.speak(u);
  };

  const start = async () => {
    const id = ++run.current;
    window.clearTimeout(hide.current);
    setCaption(null);
    setPhase('loading');

    // unlock, synchronously inside the tap (iOS)
    const a = audio.current ?? (audio.current = new Audio());
    a.setAttribute('playsinline', '');
    a.src = silence();
    a.play().catch(() => {});
    const s = synth();
    if (s) { s.cancel(); const u = new SpeechSynthesisUtterance(''); u.volume = 0; s.speak(u); }

    const ctl = new AbortController();
    abort.current = ctl;
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/speak`, { method: 'POST', signal: ctl.signal });
    } catch {
      if (run.current === id) { setCaption({ text: "Couldn't reach the farm server." }); setPhase('idle'); holdCaption(); }
      return;
    }
    if (run.current !== id) return;

    const headerText = (() => { try { return decodeURIComponent(res.headers.get('X-Farmhand-Text') ?? ''); } catch { return ''; } })();
    if (res.ok && (res.headers.get('Content-Type') ?? '').startsWith('audio/')) {
      let blob: Blob;
      try { blob = await res.blob(); } catch { if (run.current === id) { setPhase('idle'); } return; }
      if (run.current !== id) return;
      freeClip();
      clip.current = URL.createObjectURL(blob);
      a.src = clip.current;
      a.onended = () => { if (run.current === id) { setPhase('idle'); freeClip(); holdCaption(); } };
      a.onerror = null;
      if (headerText) setCaption({ text: headerText });
      try {
        await a.play();
        if (run.current === id) setPhase('playing');
      } catch {
        if (run.current === id && headerText) speakInBrowser(id, headerText, 'Browser voice: this device blocked the audio clip.');
        else if (run.current === id) setPhase('idle');
      }
      return;
    }

    // 503 (no ElevenLabs key) or 502 (ElevenLabs failed): the server still sends the sentence
    let text = headerText, err = '';
    try { const j = (await res.json()) as { text?: string; error?: string }; text = j.text || text; err = j.error || ''; } catch { /* keep the header */ }
    if (run.current !== id) return;
    if (!text) { setCaption({ text: 'The farm server could not say anything right now.' }); setPhase('idle'); holdCaption(); return; }
    speakInBrowser(id, text, res.status === 503 ? 'Browser voice (ElevenLabs is not set up on the server).' : `Browser voice (${err || 'ElevenLabs failed'}).`);
  };

  const busy = phase !== 'idle';
  return (
    <div className="listen-wrap">
      <button
        type="button"
        className={`listen listen-${phase}`}
        onClick={busy ? stop : start}
        aria-pressed={busy}
        aria-busy={phase === 'loading'}
        aria-label={busy ? 'Stop reading the farm status' : 'Listen to the farm status'}
      >
        {phase === 'playing' ? <Bars /> : <Speaker />}
        <span>{busy ? 'Stop' : 'Listen'}</span>
      </button>
      {caption && (
        <div className="listen-cap" role="status" aria-live="polite">
          <p>{caption.text}</p>
          {caption.note && <p className="listen-note">{caption.note}</p>}
          <button type="button" className="listen-x" onClick={() => { window.clearTimeout(hide.current); setCaption(null); }} aria-label="Hide caption">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

const Speaker = () => (
  <svg className="listen-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor" fillOpacity=".14" />
    <path className="listen-w1" d="M15.500 9.200a4 4 0 0 1 0 5.600" />
    <path className="listen-w2" d="M18.300 6.600a7.600 7.600 0 0 1 0 10.800" />
  </svg>
);

/** Playing: three level bars (static under reduced motion). */
const Bars = () => (
  <svg className="listen-ico listen-bars" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="5" y="6" width="3" height="12" rx="1.500" />
    <rect x="10.500" y="4" width="3" height="16" rx="1.500" />
    <rect x="16" y="8" width="3" height="8" rx="1.500" />
  </svg>
);
