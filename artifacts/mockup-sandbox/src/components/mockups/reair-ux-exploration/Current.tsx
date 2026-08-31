import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FilePlus2, LogOut, Printer, Search } from 'lucide-react';
import './_group.css';
import { type ArchiveClip, type ArchiveNote, useRealArchive } from './useRealArchive';

type Note = ArchiveNote;
type Clip = ArchiveClip;
type Filter = 'all' | 'review' | 'dates' | 'clear';
type Sort = 'new' | 'old' | 'flags' | 'id';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asDate = (value: string) => new Date(`${value}T12:00:00`);
const formatDate = (value: string) => { const d = asDate(value); return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const monthLabel = (value: string) => { const d = asDate(value); return `${monthNames[d.getMonth()]} ${d.getFullYear()}`; };
const monthKey = (value: string) => value.slice(0, 7);
const flagCount = (clip: Clip) => clip.flagCount;
const noteSeconds = (note: Note) => note.secs ?? 0;

function Logo() {
  return <div className="viewer-brand"><span className="viewer-brand-mark">Re<span>·</span>Air Report</span></div>;
}

function Stat({ value, label, flagged }: { value: string | number; label: string; flagged?: boolean }) {
  return <div className={`viewer-stat${flagged ? ' flagged' : ''}`}><b>{value}</b><span>{label}</span></div>;
}

export function Current() {
  const { clips, status, message, retry } = useRealArchive();
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [calendarMonth, setCalendarMonth] = useState('2025-04');

  useEffect(() => {
    if (!clips.some(clip => clip.id === selectedId)) {
      const next = clips[0];
      setSelectedId(next?.id ?? '');
      if (next?.date) setCalendarMonth(monthKey(next.date));
    }
  }, [clips, selectedId]);

  const view = useMemo(() => clips.filter((clip) => {
    const haystack = [clip.id, ...clip.hosts, ...clip.guests, clip.shortSynopsis, clip.longSynopsis, ...clip.sensitiveNotes.map(n => n.text), ...clip.dateNotes.map(n => n.text)].join(' ').toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === 'review') return clip.sensitiveNotes.length > 0;
    if (filter === 'dates') return clip.dateNotes.length > 0;
    if (filter === 'clear') return flagCount(clip) === 0;
    return true;
  }).sort((a, b) => sort === 'id' ? a.id.localeCompare(b.id) : sort === 'old' ? (a.date ?? '').localeCompare(b.date ?? '') : sort === 'flags' ? flagCount(b) - flagCount(a) : (b.date ?? '').localeCompare(a.date ?? '')), [clips, query, filter, sort]);
  const selected = clips.find(c => c.id === selectedId);
  const reviewCount = clips.filter(clip => clip.sensitiveNotes.length > 0).length;
  const totalFlags = clips.reduce((total, clip) => total + flagCount(clip), 0);
  const clear = () => { setQuery(''); setFilter('all'); setSort('new'); setCollapsed({}); };
  const selectClip = (id: string) => {
    setSelectedId(id);
    const clip = clips.find(item => item.id === id);
    if (clip?.date) setCalendarMonth(monthKey(clip.date));
  };

  return <main className="reair-current min-h-screen">
    <header className="viewer-header">
      <div className="brand-lockup"><Logo /><span className="source-name">Live archive</span></div>
      <div className="header-stats"><Stat value={clips.length} label="clips" /><Stat value={reviewCount} label="need review" flagged={reviewCount > 0} /><Stat value={totalFlags} label="flags" /><Stat value={status === 'ready' ? 'Live archive' : 'Archive status'} label={status === 'ready' ? 'connected' : status} /></div>
      <span className="role-badge admin">Administrator</span>
      <button className="btn"><FilePlus2 />Add report</button>
      <button className="btn ghost" onClick={clear}>Clear</button>
      <button className="btn ghost"><LogOut />Sign out</button>
    </header>
    <div className="viewer-toolbar">
      <label className="viewer-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search clip ID, people, synopsis, flags" /><kbd>/</kbd></label>
      <div className="segmented">{([['all','All'],['review','Needs review'],['dates','Dates mentioned'],['clear','No flags']] as [Filter,string][]).map(([key,label]) => <button key={key} data-f={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="segmented view-switch"><button aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button><button aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}><CalendarDays />Calendar</button></div>
      <select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="new">Newest clip date</option><option value="old">Oldest clip date</option><option value="flags">Most flags</option><option value="id">Clip ID A–Z</option></select>
      <span className="result-count">{view.length === clips.length ? `${clips.length} clips` : `${view.length} of ${clips.length} clips`}</span>
    </div>
    {status !== 'ready'
      ? <ArchiveState status={status} message={message} onRetry={retry} />
      : !clips.length
        ? <ArchiveState status="empty" message="Your live archive is empty. Add or share a report to begin reviewing clips." />
        : <div className="viewer-layout">
          <nav className={viewMode === 'list' ? 'clip-list' : 'calendar-pane'}>
            {viewMode === 'list'
              ? <ClipList clips={view} selectedId={selectedId} collapsed={collapsed} onCollapse={key => setCollapsed(old => ({ ...old, [key]: !old[key] }))} onSelect={selectClip} />
              : view.length ? <Calendar clips={view} month={calendarMonth} setMonth={setCalendarMonth} selectedId={selectedId} onSelect={selectClip} /> : <p className="empty-list">No results in the live archive.<br />Clear the search or choose a different filter.</p>}
          </nav>
          <section className="clip-detail">{selected ? <ClipDetail clip={selected} onSearch={setQuery} /> : <div className="detail-pane"><div className="detail-section"><h2>Select a clip</h2><p>Choose a clip from the live archive to inspect its details.</p></div></div>}</section>
        </div>}
  </main>;
}

function ArchiveState({ status, message, onRetry }: { status: 'loading' | 'signed-out' | 'error' | 'empty'; message: string; onRetry?: () => void }) {
  const title = status === 'loading' ? 'Loading live archive' : status === 'signed-out' ? 'Sign-in required' : status === 'error' ? 'Archive unavailable' : 'No clips in this archive';
  return <div className="viewer-layout"><section className="clip-list"><p className="empty-list">{status === 'loading' ? 'Connecting to archive…' : 'Live archive'}</p></section><section className="clip-detail"><div className="detail-pane"><div className="detail-section"><h2>{title}</h2><p>{message}</p>{onRetry && <button className="btn" onClick={onRetry}>Retry</button>}</div></div></section></div>;
}

function ClipList({ clips: visible, selectedId, collapsed, onCollapse, onSelect }: { clips: Clip[]; selectedId: string; collapsed: Record<string, boolean>; onCollapse: (key: string) => void; onSelect: (id: string) => void }) {
  if (!visible.length) return <p className="empty-list">No results in the live archive.<br />Clear the search or choose a different filter.</p>;
  let previous = '';
  return <div>{visible.map(clip => {
    const key = clip.date ? monthKey(clip.date) : 'undated'; const show = key !== previous; previous = key;
    return <div key={clip.id}>{show && <button className="clip-group" aria-expanded={!collapsed[key]} onClick={() => onCollapse(key)}><span>{clip.date ? monthLabel(clip.date) : 'Undated clips'}</span><ChevronRight className={collapsed[key] ? '' : 'expanded'} /></button>}
      {!collapsed[key] && <button className={`clip-item${flagCount(clip) ? '' : ' is-clear'}${selectedId === clip.id ? ' selected' : ''}`} onClick={() => onSelect(clip.id)}>
        <div><span className="clip-id">{clip.id}</span>{clip.revision && <span className="revision">{clip.revision}</span>}</div>
        <div className="clip-sub">{[...clip.hosts, ...clip.guests].join(', ')}</div>
        <div className="clip-airdate">Original airdate · {clip.originalAir ? formatDate(clip.originalAir) : 'Not listed'}</div>
        <div className="clip-pips">{clip.sensitiveNotes.length > 0 && <span className="pip amber"><i />{clip.sensitiveNotes.length} date-sensitive</span>}{clip.dateNotes.length > 0 && <span className="pip cyan"><i />{clip.dateNotes.length} dates</span>}{flagCount(clip) === 0 && <span className="pip clear"><i />no flags</span>}</div>
      </button>}</div>;
  })}</div>;
}

function Calendar({ clips: visible, month, setMonth, selectedId, onSelect }: { clips: Clip[]; month: string; setMonth: (m: string) => void; selectedId: string; onSelect: (id: string) => void }) {
  const [year, monthNo] = month.split('-').map(Number); const first = new Date(year, monthNo - 1, 1); const days = new Date(year, monthNo, 0).getDate();
  const shift = (delta: number) => { const d = new Date(year, monthNo - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`); };
  const byDay = new Map<number, Clip[]>(); visible.filter((c): c is Clip & { date: string } => c.date !== null && monthKey(c.date) === month).forEach(c => { const d = asDate(c.date).getDate(); byDay.set(d, [...(byDay.get(d) ?? []), c]); });
  const current = new Date(year, monthNo - 1, 1);
  return <div className="calendar-view"><div className="calendar-header"><button className="icon-button" onClick={() => shift(-1)}><ChevronLeft /></button><h2>{monthNames[current.getMonth()]} {year}</h2><button className="icon-button" onClick={() => shift(1)}><ChevronRight /></button></div>
    <div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}</div>
    <div className="calendar-grid">{Array.from({length: first.getDay()},(_,i) => <span className="calendar-blank" key={`b${i}`} />)}{Array.from({length: days},(_,i) => { const day = i+1; const dayClips = byDay.get(day) ?? []; return <button key={day} className={`calendar-day${dayClips.length ? ' has-clips' : ''}${dayClips.some(c => c.id === selectedId) ? ' selected' : ''}`} onClick={() => dayClips[0] && onSelect(dayClips[0].id)}><span>{day}</span>{dayClips.length > 0 && <b>{dayClips.length}</b>}</button>; })}</div>
    <div className="calendar-day-heading">Clips in {monthNames[current.getMonth()]} {year}</div>
    <div className="calendar-day-clips">{visible.filter(c => c.date !== null && monthKey(c.date) === month).map(c => <button key={c.id} className={`calendar-clip${selectedId === c.id ? ' selected' : ''}`} onClick={() => onSelect(c.id)}><strong>{c.id}</strong><span>{c.sensitiveNotes.length} review · {c.dateNotes.length} dates</span></button>)}</div>
  </div>;
}

function ClipDetail({ clip, onSearch }: { clip: Clip; onSearch: (q: string) => void }) {
  const notes = [...clip.sensitiveNotes, ...clip.dateNotes]; const span = 1800; const pos = (note: Note) => `${Math.min(100, noteSeconds(note) / span * 100)}%`;
  return <div className="detail-pane">
    <div className="detail-top"><div><h1>{clip.id}</h1><div className="detail-sub">Clip date {clip.date ? formatDate(clip.date) : 'Not listed'}{clip.revision ? ` · ${clip.revision} version` : ''}{clip.time ? ` · ${clip.time}` : ''}</div></div><div className={`verdict ${clip.sensitiveNotes.length ? 'review' : 'clear'}`}><i />{clip.sensitiveNotes.length ? `Needs review — ${clip.sensitiveNotes.length} item${clip.sensitiveNotes.length > 1 ? 's' : ''}` : 'No date-sensitive items flagged'}</div></div>
    <dl className="clip-meta"><div><dt>Original air</dt><dd>{clip.originalAir ? formatDate(clip.originalAir) : 'Not listed'}</dd></div><div><dt>Last air</dt><dd>{clip.lastAir ? formatDate(clip.lastAir) : 'Not listed'}</dd></div><div><dt>Host</dt><dd>{clip.hosts.map(p => <button className="chip-link" key={p} onClick={() => onSearch(p)}>{p}</button>)}</dd></div><div><dt>Guests</dt><dd>{clip.guests.map(p => <button className="chip-link" key={p} onClick={() => onSearch(p)}>{p}</button>)}</dd></div><div><dt>Source report</dt><dd className="source-meta">{clip.source}</dd></div></dl>
    <section className="detail-section"><h2>Synopsis</h2><div className="synopsis"><div><h3>Short</h3><p>{clip.shortSynopsis}</p></div><div><h3>Full</h3><p>{clip.longSynopsis}</p></div></div></section>
    <section className="detail-section"><h2>Flag timeline</h2>{notes.length ? <><div className="timeline"><div className="timeline-inner"><div className="timeline-track" />{[0,300,600,900,1200,1500,1800].map(s => <div key={s}><span className={`timeline-tick${s % 600 ? ' minor' : ''}`} style={{left: `${Math.min(100, s / span * 100)}%`}} />{s % 600 === 0 && <span className="timeline-label" style={{left: `${Math.min(100, s / span * 100)}%`}}>{s/60}:00</span>}</div>)}<div className="timeline-lane top">{clip.sensitiveNotes.map((n, index) => <span className="timeline-marker amber-marker" style={{left:pos(n)}} key={`${n.tc}-${index}`}><span className="marker-stem" /><span className="marker-dot" /></span>)}</div><div className="timeline-lane bottom">{clip.dateNotes.map((n, index) => <span className="timeline-marker cyan-marker" style={{left:pos(n)}} key={`${n.tc}-${index}`}><span className="marker-dot" /><span className="marker-stem" /></span>)}</div></div></div><div className="timeline-legend"><span><i className="amber-dot" />above the line — date-sensitive material</span><span><i className="cyan-dot" />below the line — dates mentioned</span><span>scale 0:00 – 30:00</span></div></> : <div className="timeline-empty">No timecoded flags on this clip</div>}</section>
    {clip.sensitiveNotes.length > 0 && <Notes title="Date-sensitive material" notes={clip.sensitiveNotes} kind="amber" />}
    {clip.dateNotes.length > 0 && <Notes title="Dates mentioned" notes={clip.dateNotes} kind="cyan" />}
    <button className="btn print-button" onClick={() => window.print()}><Printer />Print clip sheet</button>
  </div>;
}

function Notes({ title, notes, kind }: { title: string; notes: Note[]; kind: 'amber' | 'cyan' }) {
  return <section className="detail-section"><h2>{title}<span className="note-count">{notes.length}</span></h2><div className="notes-grid">{notes.map((n, index) => <div className={`note-card ${kind}`} key={`${n.tc}-${index}`}><span className="timecode">{n.tc || '—'}</span><p>{n.text}</p></div>)}</div></section>;
}