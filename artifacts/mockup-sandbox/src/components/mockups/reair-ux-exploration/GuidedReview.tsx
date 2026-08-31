import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Flag, HelpCircle, Printer, Search, UserRound } from 'lucide-react';
import './_group.css';
import './GuidedReview.css';
import { useRealArchive, type ArchiveClip } from './useRealArchive';

type Clip = {
  id: string;
  air: string;
  people: string;
  short: string;
  full: string;
  flags: { tc: string; text: string }[];
  dates: string[];
  last: string;
  source: string;
};

const displayDate = (value: string | null) => value || 'Not recorded';

function presentClip(clip: ArchiveClip): Clip {
  const people = [...clip.hosts, ...clip.guests];
  return {
    id: clip.id,
    air: displayDate(clip.originalAir),
    people: people.length ? people.join(' · ') : 'Host / guests not recorded',
    short: clip.shortSynopsis,
    full: clip.longSynopsis,
    flags: [...clip.sensitiveNotes, ...clip.dateNotes].map(note => ({
      tc: note.tc || '—',
      text: note.text,
    })),
    dates: clip.dateNotes.map(note => `${note.tc ? `${note.tc} · ` : ''}${note.text}`),
    last: displayDate(clip.lastAir),
    source: clip.source,
  };
}

export function GuidedReview() {
  const archive = useRealArchive();
  const clips = useMemo(() => archive.clips.map(presentClip), [archive.clips]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [showSynopsis, setShowSynopsis] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setSelectedId(current => current && clips.some(clip => clip.id === current) ? current : clips[0]?.id ?? null);
    setDecision(current => Object.fromEntries(Object.entries(current).filter(([id]) => clips.some(clip => clip.id === id))));
  }, [clips]);

  const selected = Math.max(0, clips.findIndex(clip => clip.id === selectedId));
  const clip = clips[selected];
  const visible = useMemo(
    () => clips.filter(item => `${item.id} ${item.people} ${item.short} ${item.flags.map(flag => flag.text).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),
    [clips, query],
  );
  const reviewed = clips.filter(item => decision[item.id]).length;
  const setVerdict = (value: string) => {
    if (clip) setDecision(old => ({ ...old, [clip.id]: value }));
  };
  const next = () => {
    if (!clip) return;
    const pending = clips.findIndex((item, index) => index > selected && !decision[item.id]);
    const nextIndex = pending >= 0 ? pending : Math.min(selected + 1, clips.length - 1);
    setSelectedId(clips[nextIndex]?.id ?? null);
    setShowSynopsis(false);
  };

  const isReady = archive.status === 'ready';
  const stateTitle = archive.status === 'loading'
    ? 'Loading live archive'
    : archive.status === 'signed-out'
      ? 'Sign in required'
      : archive.status === 'error'
        ? 'Archive unavailable'
        : 'Your archive is empty';

  return <main className="reair-guided">
    <header className="guided-topbar">
      <div className="guided-wordmark">Re<b>·</b>Air / Review Desk</div>
      <div className="guided-context">{isReady ? `Live archive · ${clips.length} real clip${clips.length === 1 ? '' : 's'}` : 'Authenticated archive'}</div>
      <div className="guided-top-actions"><button onClick={() => window.print()}><Printer /> Print sheet</button><div className="guided-utility"><button className="guided-icon" aria-label="User menu" onClick={() => setShowMenu(v => !v)}><UserRound /></button>{showMenu && <div className="guided-menu"><button onClick={() => setShowMenu(false)}>Review session</button><button onClick={() => setShowMenu(false)}>Archive settings</button></div>}</div></div>
    </header>

    {(!isReady || !clip) ? (
      <section className={`guided-state guided-state-${archive.status}`} aria-live="polite" aria-busy={archive.status === 'loading'}>
        <small>{isReady ? 'Live archive' : 'Archive connection'}</small>
        <h1>{stateTitle}</h1>
        <p>{archive.message}</p>
        {(archive.status === 'signed-out' || archive.status === 'error') && <button onClick={() => void archive.retry()}>Retry</button>}
      </section>
    ) : (
      <>
        <section className="guided-progress"><div className="progress-copy"><small>Guided review · Live archive</small><strong>Resolve each decision before moving on</strong></div><div className="progress-meter" aria-label={`${reviewed} of ${clips.length} clips reviewed`}><span style={{ width: `${clips.length ? reviewed / clips.length * 100 : 0}%` }} /></div><div className="progress-count">{reviewed} / {clips.length} resolved</div></section>
        <div className="guided-shell">
          <aside className="guided-queue"><p className="queue-caption">Review queue · real archive notes</p><div className="queue-filter"><input aria-label="Search review queue" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a clip or person" /><button aria-label="Search"><Search size={15}/></button></div><div className="queue-list">{visible.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); setShowSynopsis(false); }} className={`queue-card ${selectedId === item.id ? 'is-active' : ''} ${decision[item.id] ? 'is-done' : ''}`}><strong>{item.id}</strong><span>{item.people}</span><em>{decision[item.id] ? decision[item.id] : `${item.flags.length} archive note${item.flags.length === 1 ? '' : 's'}`}</em></button>)}{visible.length === 0 && <p className="queue-empty">No clips match this search.</p>}</div></aside>
          <section className="guided-main">
            <div className="clip-kicker"><span>Now reviewing · clip {selected + 1} of {clips.length}</span><button onClick={next}>Skip to next <ChevronRight size={14}/></button></div>
            <h1 className="clip-title">{clip.id}</h1><p className="clip-deck">{clip.short || 'No short synopsis was provided.'}</p>
            {clip.flags.length ? <><div className="review-question"><Flag /><div><strong>Could this material mislead a listener if aired now?</strong><span>Review the sensitive and date notes below, then record an editorial disposition.</span></div></div><p className="section-label">Archive notes requiring a decision</p><div className="evidence-list">{clip.flags.map((flag, index) => <article className="evidence" key={`${flag.tc}-${index}`}><time>{flag.tc}</time><p>{flag.text}</p></article>)}</div></> : <div className="review-question"><HelpCircle /><div><strong>No sensitive or date notes were recorded.</strong><span>Check the supporting history, then clear this clip for the next air window.</span></div></div>}
            <section className="decision-box"><h2>Editorial disposition</h2><div className="decision-actions">{['Needs edit', 'Hold for context', 'Clear for re-air'].map(action => <button className={decision[clip.id] === action ? 'active' : ''} key={action} onClick={() => setVerdict(action)}>{action}</button>)}</div>{decision[clip.id] && <p className="decision-note">Recorded locally as “{decision[clip.id]}”. The queue is updated; no archive data was changed.</p>}</section>
          </section>
          <aside className="guided-context-panel"><h2>Supporting context</h2><div className="fact-grid"><div className="fact"><span className="fact-label">Original airdate</span><span className="fact-value">{clip.air}</span></div><div className="fact"><span className="fact-label">Last aired</span><span className="fact-value">{clip.last}</span></div><div className="fact"><span className="fact-label">Host / guests</span><span className="fact-value">{clip.people}</span></div><div className="fact"><span className="fact-label">Date notes</span><span className="fact-value">{clip.dates.length ? clip.dates.join(' · ') : 'None recorded'}</span></div><div className="fact"><span className="fact-label">Source</span><span className="fact-value">{clip.source}</span></div></div><div className="context-extra"><button className={`context-toggle ${showSynopsis ? 'open' : ''}`} onClick={() => setShowSynopsis(v => !v)}>Full synopsis <ChevronDown /></button><div className={`disclosure ${showSynopsis ? 'open' : ''}`}><p>{clip.full || 'No full synopsis was provided.'}</p></div><div className="mini-timeline" aria-label={`${clip.flags.length} archive notes`}>{clip.flags.slice(0, 8).map((_, index) => <i key={index} style={{ left: `${((index + 1) / (Math.min(clip.flags.length, 8) + 1)) * 100}%` }} />)}</div><div className="timeline-label-guided"><span>00:00</span><span>End</span></div></div></aside>
        </div>
      </>
    )}
  </main>;
}