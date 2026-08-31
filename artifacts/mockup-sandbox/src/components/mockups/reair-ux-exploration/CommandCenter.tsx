import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, FilePlus2, Flag, LogOut, Search, SkipForward, UserRound } from 'lucide-react';
import './_group.css';
import './CommandCenter.css';
import { useRealArchive, type ArchiveClip } from './useRealArchive';

type Note = { tc: string; text: string; kind: 'risk' | 'date' };
type Clip = { id: string; date: string; archiveTime: string; originalAir: string; lastAir: string; hosts: string[]; guests: string[]; short: string; full: string; notes: Note[]; source: string; status: 'urgent' | 'review' | 'clear' };

const format = (d: string) => {
  const date = new Date(`${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

function presentClip(clip: ArchiveClip): Clip {
  const notes: Note[] = [
    ...clip.sensitiveNotes.map(note => ({ tc: note.tc, text: note.text, kind: 'risk' as const })),
    ...clip.dateNotes.map(note => ({ tc: note.tc, text: note.text, kind: 'date' as const })),
  ];
  return {
    id: clip.id,
    date: clip.date ?? '',
    archiveTime: clip.time ?? '',
    originalAir: clip.originalAir ?? '',
    lastAir: clip.lastAir ?? '',
    hosts: clip.hosts,
    guests: clip.guests,
    short: clip.shortSynopsis,
    full: clip.longSynopsis || clip.shortSynopsis,
    notes,
    source: clip.source,
    status: clip.sensitiveNotes.length > 1 ? 'urgent' : clip.flagCount > 0 ? 'review' : 'clear',
  };
}

export function CommandCenter() {
  const archive = useRealArchive();
  const clips = useMemo(() => archive.clips.map(presentClip), [archive.clips]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'queue' | 'archive'>('queue');
  const [done, setDone] = useState<string[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [notice, setNotice] = useState('');
  const queue = useMemo(() => clips.filter(c => !done.includes(c.id) && (mode === 'archive' || c.status !== 'clear') && [c.id, ...c.hosts, ...c.guests, c.short, ...c.notes.map(n => n.text)].join(' ').toLowerCase().includes(query.toLowerCase())), [clips, done, mode, query]);
  const clip = queue.find(c => c.id === active) ?? queue[0] ?? null;
  const risks = clip?.notes.filter(n => n.kind === 'risk') ?? [];
  const dateCount = clips.reduce((total, item) => total + item.notes.filter(note => note.kind === 'date').length, 0);
  const sourceCount = new Set(archive.clips.map(item => item.reportId)).size;

  useEffect(() => {
    if (active !== (clip?.id ?? null)) {
      setActive(clip?.id ?? null);
      setShowFull(false);
    }
  }, [active, clip?.id]);

  const finish = () => {
    if (!clip) return;
    setDone(old => [...old, clip.id]);
    setNotice(`${clip.id} marked reviewed`);
    setShowFull(false);
  };
  return <main className="reair-command">
    <header className="cc-topbar">
      <div className="cc-brand"><span className="cc-signal" /><span>RE·AIR</span><b>REVIEW DESK</b></div>
      <div className="cc-shift"><span>{archive.status === 'ready' ? 'LIVE ARCHIVE' : 'ARCHIVE CONNECTION'}</span><strong>{archive.status === 'ready' ? `${clips.length} real clip${clips.length === 1 ? '' : 's'}` : archive.status.replace('-', ' ')}</strong></div>
      <button className="cc-user" onClick={() => setNotice('Signed in as Administrator')}><UserRound /> Administrator <ChevronDown /></button>
      <button className="cc-icon" aria-label="Add report" onClick={() => setNotice('Report intake is ready')}><FilePlus2 /></button>
      <button className="cc-icon" aria-label="Sign out" onClick={() => setNotice('Sign out action staged')}><LogOut /></button>
    </header>
    <section className="cc-command">
      <div><p className="eyebrow">REVIEW COMMAND CENTER</p><h1>Hold the line on<br /><em>what has changed.</em></h1></div>
      <div className="cc-metrics"><Metric n={`${queue.length}`} l="IN ACTIVE QUEUE" /><Metric n={`${queue.filter(c => c.status === 'urgent').length}`} l="URGENT HOLDS" alert /><Metric n={`${dateCount}`} l="DATES MENTIONED" /><Metric n={`${sourceCount}`} l="SOURCE REPORTS" /></div>
      <label className="cc-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search archive, people, evidence" /><kbd>/</kbd></label>
    </section>
    {archive.status !== 'ready' ? <ArchiveState status={archive.status} message={archive.message} retry={archive.retry} /> : clips.length === 0 ? <ArchiveState status="empty" message={archive.message} /> :
    <div className="cc-workspace">
      <aside className="cc-queue">
        <div className="cc-tabs"><button className={mode === 'queue' ? 'active' : ''} onClick={() => setMode('queue')}>Priority queue</button><button className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>Archive</button></div>
        <div className="cc-queue-head"><span>{mode === 'queue' ? 'UNRESOLVED WORK' : 'SHARED ARCHIVE'}</span><span>{queue.length} clips</span></div>
        <div className="cc-list">{queue.length ? queue.map((c, i) => <button key={c.id} className={`cc-item ${c.id === clip?.id ? 'selected' : ''}`} onClick={() => { setActive(c.id); setShowFull(false); }}><span className={`cc-rank ${c.status}`}>{String(i + 1).padStart(2, '0')}</span><div><strong>{c.id}</strong><p>{c.short}</p><small>{c.hosts.join(', ') || 'Host not recorded'} · aired {c.originalAir ? format(c.originalAir) : 'date not recorded'}</small></div><span className="cc-item-count">{c.notes.length || '—'}</span></button>) : <div className="cc-empty"><Check />No matching clips<br /><span>Adjust search or view the full archive.</span></div>}</div>
        <button className="cc-archive-link" onClick={() => setMode('archive')}><CalendarDays /> Browse by air date <ChevronRight /></button>
      </aside>
      {clip ? <section className="cc-case">
        <div className="cc-case-top"><div><p className="eyebrow">NOW REVIEWING · {clip.status === 'urgent' ? 'URGENT HOLD' : clip.status.toUpperCase()}</p><h2>{clip.id}</h2><span>{clip.archiveTime ? `archive time ${clip.archiveTime} · ` : ''}clip date {clip.date ? format(clip.date) : 'not recorded'}</span></div><div className="cc-case-actions"><button className="cc-button secondary" onClick={() => setNotice(`Skipped ${clip.id}; it remains in the queue`)}><SkipForward /> Skip</button><button className="cc-button complete" onClick={finish}><Check /> Mark reviewed</button></div></div>
        <div className="cc-context"><div><label>ORIGINAL AIR</label><b>{clip.originalAir ? format(clip.originalAir) : 'Not recorded'}</b></div><div><label>LAST AIR</label><b>{clip.lastAir ? format(clip.lastAir) : 'Not recorded'}</b></div><div><label>HOST / GUESTS</label><b>{[...clip.hosts, ...clip.guests].join(' · ') || 'Not recorded'}</b></div><div><label>SOURCE</label><b>{clip.source}</b></div></div>
        <div className="cc-evidence-title"><div><Flag /><div><p className="eyebrow">EVIDENCE REGISTER</p><h3>{risks.length ? `${risks.length} broadcast hold${risks.length > 1 ? 's' : ''} require a decision` : 'No active broadcast holds'}</h3></div></div><button onClick={() => setNotice('Report incident form staged')}><AlertTriangle /> Report issue</button></div>
        <div className="cc-timeline"><div className="cc-line" />{clip.notes.map((n, i) => <button key={`${n.tc}-${n.kind}-${i}`} className={`cc-pin ${n.kind}`} style={{ left: `${10 + i * (75 / Math.max(1, clip.notes.length - 1))}%` }} onClick={() => setNotice(n.tc ? `Jumped to ${n.tc}` : 'This evidence has no recorded timecode')}><span>{n.tc || '—'}</span><i /></button>)}<small>00:00</small><small>10:00</small><small>20:00</small><small>END</small></div>
        <div className="cc-evidence">{clip.notes.length ? clip.notes.map((n, i) => <article className={`cc-note ${n.kind}`} key={`${n.tc}-${n.text}-${i}`}><div><span className="cc-tc"><Clock3 /> {n.tc || 'No timecode'}</span><span className="cc-kind">{n.kind === 'risk' ? 'DATE-SENSITIVE' : 'DATE MENTIONED'}</span></div><p>{n.text}</p><button onClick={() => setNotice(n.tc ? `Evidence at ${n.tc} queued for review` : 'Untimed evidence queued for review')}>Inspect <ChevronRight /></button></article>) : <div className="cc-no-evidence"><Check /> No timecoded flags were found in this clip.</div>}</div>
        <section className="cc-synopsis"><div className="cc-section-label">SYNOPSIS</div><p>{showFull ? clip.full : clip.short}</p><button onClick={() => setShowFull(v => !v)}>{showFull ? 'Show short synopsis' : 'Read full context'} <ChevronRight /></button></section>
      </section> : <section className="cc-case cc-no-selection" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}><Search /><h2>No clips match this view</h2><p>Adjust your search or switch archive views to select a real clip.</p></section>}
    </div>
    }
    {notice && <button className="cc-toast" onClick={() => setNotice('')}><Check /> {notice}</button>}
  </main>;
}

function Metric({ n, l, alert }: { n: string; l: string; alert?: boolean }) { return <div className={alert ? 'alert' : ''}><strong>{n}</strong><span>{l}</span></div>; }

function ArchiveState({ status, message, retry }: { status: 'loading' | 'signed-out' | 'error' | 'empty'; message: string; retry?: () => void }) {
  const title = status === 'loading' ? 'Connecting to the live archive' : status === 'signed-out' ? 'Sign in required' : status === 'error' ? 'Archive unavailable' : 'Your archive is empty';
  return <section className={`cc-archive-state cc-case ${status}`} aria-live="polite" style={{ display: 'flex', minHeight: 'calc(100dvh - 170px)', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
    {status === 'loading' ? <Clock3 /> : status === 'empty' ? <CalendarDays /> : <AlertTriangle />}
    <p className="eyebrow">REAL ARCHIVE</p>
    <h2 style={{ margin: '2px 0 8px' }}>{title}</h2>
    <p style={{ maxWidth: 470, margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>{message}</p>
    {retry && <button className="cc-button secondary" style={{ marginTop: 20 }} onClick={() => void retry()}><ArrowRight /> Retry</button>}
  </section>;
}