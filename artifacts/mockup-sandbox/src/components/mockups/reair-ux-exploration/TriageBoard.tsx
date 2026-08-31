import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock3, FileText, Filter, Flag, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useRealArchive, type ArchiveClip } from './useRealArchive';
import './TriageBoard.css';

type Verdict = 'Clear' | 'Context' | 'Edit';
type BoardClip = {
  id: string;
  people: string;
  synopsis: string;
  air: string;
  last: string;
  source: string;
  notes: { tc: string; text: string }[];
  full: string;
};

const present = (clip: ArchiveClip): BoardClip => ({
  id: clip.id,
  people: [...clip.hosts, ...clip.guests].join(' · ') || 'People not recorded',
  synopsis: clip.shortSynopsis || 'No synopsis was provided for this archive record.',
  air: clip.originalAir || 'Not recorded',
  last: clip.lastAir || 'Not recorded',
  source: clip.source,
  notes: [...clip.sensitiveNotes, ...clip.dateNotes].map(note => ({ tc: note.tc || '—', text: note.text })),
  full: clip.longSynopsis || 'No extended synopsis was recorded.',
});

export function TriageBoard() {
  const archive = useRealArchive();
  const clips = useMemo(() => archive.clips.map(present), [archive.clips]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [noteOnly, setNoteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSelected(current => current && clips.some(clip => clip.id === current) ? current : clips[0]?.id ?? null);
  }, [clips]);

  const openClip = clips.find(clip => clip.id === selected);
  const filtered = clips.filter(clip => {
    const haystack = `${clip.id} ${clip.people} ${clip.synopsis} ${clip.notes.map(note => note.text).join(' ')}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (!noteOnly || clip.notes.length > 0);
  });
  const pending = filtered.filter(clip => !verdicts[clip.id]);
  const clear = filtered.filter(clip => verdicts[clip.id] === 'Clear');
  const review = filtered.filter(clip => verdicts[clip.id] === 'Context' || verdicts[clip.id] === 'Edit');
  const setVerdict = (verdict: Verdict) => {
    if (!openClip) return;
    setVerdicts(current => ({ ...current, [openClip.id]: verdict }));
  };

  if (archive.status !== 'ready') {
    return <main className="triage-root triage-state"><div className="state-mark"><ShieldCheck size={25} /></div><p className="eyebrow">Re·Air archive</p><h1>{archive.status === 'loading' ? 'Opening the review board' : archive.status === 'signed-out' ? 'Sign in to open triage' : 'Archive connection paused'}</h1><p>{archive.message}</p>{archive.status !== 'loading' && <button onClick={() => void archive.retry()}>Try again <ArrowUpRight size={15} /></button>}</main>;
  }

  const Column = ({ label, count, tone, items }: { label: string; count: number; tone: string; items: BoardClip[] }) => (
    <section className={`triage-column ${tone}`}>
      <header><div><span className="column-dot" /><h2>{label}</h2></div><b>{count}</b></header>
      <div className="board-stack">
        {items.map(clip => <button key={clip.id} onClick={() => setSelected(clip.id)} className={`triage-card ${selected === clip.id ? 'selected' : ''}`}>
          <div className="card-top"><strong>{clip.id}</strong>{clip.notes.length > 0 && <span className="note-count"><Flag size={11} /> {clip.notes.length}</span>}</div>
          <p>{clip.synopsis}</p>
          <footer><span>{clip.people}</span><time>{clip.air}</time></footer>
        </button>)}
        {!items.length && <div className="lane-empty">No clips here</div>}
      </div>
    </section>
  );

  return <main className="triage-root">
    <header className="triage-topbar">
      <div className="triage-brand"><span className="brand-glyph">R</span><span>Re<b>·</b>Air</span><i>EDITORIAL TRIAGE</i></div>
      <div className="top-status"><span /><span>Live archive</span><b>{clips.length} clips</b></div>
      <button className="top-action" onClick={() => setShowFilters(value => !value)}><SlidersHorizontal size={16} /> Board settings</button>
    </header>
    <section className="triage-heading">
      <div><p className="eyebrow">Today’s re-air window</p><h1>Make the call,<br /><em>at a glance.</em></h1></div>
      <div className="heading-meta"><div><b>{Object.keys(verdicts).length}</b><span>resolved</span></div><div><b>{clips.length - Object.keys(verdicts).length}</b><span>awaiting a call</span></div></div>
    </section>
    <section className="triage-controls">
      <label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search clips, guests, archive notes" /></label>
      <button className={noteOnly ? 'is-on' : ''} onClick={() => setNoteOnly(value => !value)}><Flag size={15} /> Has notes</button>
      <button onClick={() => setShowFilters(value => !value)}><Filter size={15} /> Filter</button>
      {showFilters && <div className="filter-popover"><span>Showing live archive entries</span><button onClick={() => { setQuery(''); setNoteOnly(false); setShowFilters(false); }}>Reset board</button></div>}
    </section>
    <section className="triage-board">
      <Column label="To assess" count={pending.length} tone="pending" items={pending} />
      <Column label="Safe to schedule" count={clear.length} tone="clear" items={clear} />
      <Column label="Needs attention" count={review.length} tone="attention" items={review} />
    </section>
    {openClip && <aside className="clip-sheet" aria-label={`Review ${openClip.id}`}>
      <header><div><p className="eyebrow">Selected clip</p><h2>{openClip.id}</h2></div><button onClick={() => setSelected(null)} aria-label="Close review"><X size={19} /></button></header>
      <div className="sheet-scroll">
        <p className="sheet-people">{openClip.people}</p><p className="sheet-summary">{openClip.synopsis}</p>
        <div className="fact-row"><div><Clock3 size={14} /><span>Original air</span><b>{openClip.air}</b></div><div><FileText size={14} /><span>Source</span><b>{openClip.source}</b></div></div>
        <div className="notes-head"><h3>What needs your judgement</h3><span>{openClip.notes.length} note{openClip.notes.length === 1 ? '' : 's'}</span></div>
        {openClip.notes.length ? <div className="sheet-notes">{openClip.notes.map((note, index) => <article key={`${note.tc}-${index}`}><time>{note.tc}</time><p>{note.text}</p></article>)}</div> : <div className="no-notes"><Check size={16} /> No flagged archive notes. Confirm against the full synopsis below.</div>}
        <details><summary>Full archive synopsis</summary><p>{openClip.full}</p></details>
      </div>
      <footer className="sheet-actions"><p>{verdicts[openClip.id] ? `Marked: ${verdicts[openClip.id]}` : 'Choose a disposition'}</p><div><button className={verdicts[openClip.id] === 'Edit' ? 'chosen edit' : ''} onClick={() => setVerdict('Edit')}>Needs edit</button><button className={verdicts[openClip.id] === 'Context' ? 'chosen context' : ''} onClick={() => setVerdict('Context')}>Add context</button><button className={verdicts[openClip.id] === 'Clear' ? 'chosen clear' : ''} onClick={() => setVerdict('Clear')}>Clear <Check size={14} /></button></div></footer>
    </aside>}
  </main>;
}