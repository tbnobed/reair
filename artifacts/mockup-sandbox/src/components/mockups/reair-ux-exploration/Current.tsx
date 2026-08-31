import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FilePlus2, LogOut, Printer, Search } from 'lucide-react';
import './_group.css';

type Note = { tc: string; secs: number; text: string };
type Clip = {
  id: string; date: string; time?: string; revision?: string; originalAir?: string; lastAir?: string;
  hosts: string[]; guests: string[]; shortSynopsis: string; longSynopsis: string; source: string;
  sensitiveNotes: Note[]; dateNotes: Note[];
};
type Filter = 'all' | 'review' | 'dates' | 'clear';
type Sort = 'new' | 'old' | 'flags' | 'id';

const clips: Clip[] = [
  {
    id: 'RA-2025-04-18-01', date: '2025-04-18', time: '00:28:46', revision: 'REV 2',
    originalAir: '2024-10-11', lastAir: '2025-01-03', hosts: ['Mara Li'], guests: ['Dr. Elena Ruiz', 'Caleb Foster'],
    shortSynopsis: 'A conversation about coastal resilience, municipal planning, and the communities adapting to a changing shoreline.',
    longSynopsis: 'Mara Li speaks with urban ecologist Dr. Elena Ruiz and harbor planner Caleb Foster about how coastal cities are preparing for stronger storm surges. The guests compare seawalls with restored wetlands, discuss the difficult economics of relocation, and explain why neighborhood-level planning must begin years before construction. The final segment follows a pilot project that converted a disused industrial lot into a floodable public park.',
    source: 'Spring 2025 Re-Air Review.csv',
    sensitiveNotes: [
      { tc: '04:18', secs: 258, text: 'Guest says the pilot project will open “this September.” Update or remove before rebroadcast.' },
      { tc: '22:41', secs: 1361, text: 'Host refers to the mayoral vote as happening “next week.” This is no longer current.' },
    ],
    dateNotes: [
      { tc: '08:06', secs: 486, text: 'References Hurricane Sandy in October 2012.' },
      { tc: '17:32', secs: 1052, text: 'Project funding period is identified as 2024 through 2027.' },
    ],
  },
  {
    id: 'RA-2025-04-07-03', date: '2025-04-07', originalAir: '2023-06-22', lastAir: '2024-08-15',
    hosts: ['Mara Li'], guests: ['Nikhil Shah'], source: 'Spring 2025 Re-Air Review.csv',
    shortSynopsis: 'Composer Nikhil Shah demonstrates how field recordings become the rhythmic foundation of a new work.',
    longSynopsis: 'An in-studio performance and interview tracing sounds collected in train stations, markets, and workshops into a chamber composition. Shah discusses listening as a compositional practice and performs two short excerpts.',
    sensitiveNotes: [], dateNotes: [{ tc: '12:14', secs: 734, text: 'Mentions the album release date of June 30, 2023.' }],
  },
  {
    id: 'RA-2025-03-26-02', date: '2025-03-26', time: '00:31:10', originalAir: '2024-03-02', lastAir: '2024-11-18',
    hosts: ['Owen Price'], guests: ['Fatima Bell'], source: 'Spring 2025 Re-Air Review.csv',
    shortSynopsis: 'An oral historian on preserving the stories and working life of a changing neighborhood.',
    longSynopsis: 'Owen Price joins oral historian Fatima Bell on a walking tour through the East Market district. Bell shares recordings from shopkeepers and residents while describing the practical work of building a public archive.',
    sensitiveNotes: [{ tc: '02:09', secs: 129, text: 'Introduction calls the exhibition “currently on view.” Exhibition has closed.' }],
    dateNotes: [{ tc: '14:52', secs: 892, text: 'Neighborhood association formed in 1978.' }, { tc: '26:03', secs: 1563, text: 'Archive began collecting interviews in 2019.' }],
  },
  {
    id: 'RA-2025-03-12-01', date: '2025-03-12', originalAir: '2022-09-09', lastAir: '2024-02-16',
    hosts: ['Owen Price'], guests: ['Leah Kim', 'Robert Vance'], source: 'Spring 2025 Re-Air Review.csv',
    shortSynopsis: 'Two conservators explain what centuries-old paper can reveal about the people who made and used it.',
    longSynopsis: 'A visit to the paper conservation laboratory covers fibers, watermarks, inks, and the small repairs that allow rare manuscripts to be handled safely.',
    sensitiveNotes: [], dateNotes: [],
  },
  {
    id: 'RA-2025-02-21-04', date: '2025-02-21', revision: 'REV 1', originalAir: '2024-02-21', lastAir: '2024-12-20',
    hosts: ['Mara Li'], guests: ['Imani Woods'], source: 'Winter Archive Audit.csv',
    shortSynopsis: 'Chef Imani Woods traces a family recipe through migration, adaptation, and three generations of home kitchens.',
    longSynopsis: 'Woods prepares a celebratory rice dish while explaining how ingredients and techniques changed as her family moved between regions. The conversation considers recipe cards as historical records.',
    sensitiveNotes: [{ tc: '27:16', secs: 1636, text: 'Closing promotes a restaurant residency ending this month.' }],
    dateNotes: [{ tc: '06:44', secs: 404, text: 'Family arrived in Baltimore in 1966.' }],
  },
  {
    id: 'RA-2025-02-05-02', date: '2025-02-05', originalAir: '2023-11-10', lastAir: '2024-04-05',
    hosts: ['Owen Price'], guests: ['Sofia Mendes'], source: 'Winter Archive Audit.csv',
    shortSynopsis: 'A telescope engineer describes the delicate process of aligning mirrors for deep-space observation.',
    longSynopsis: 'Engineer Sofia Mendes takes listeners inside an optics laboratory, describing mirror coatings, vibration tests, and the teamwork required to commission a new instrument.',
    sensitiveNotes: [], dateNotes: [{ tc: '19:08', secs: 1148, text: 'References the 2021 instrument commissioning campaign.' }],
  },
  {
    id: 'RA-2025-01-17-01', date: '2025-01-17', originalAir: '2024-01-17', hosts: ['Mara Li'], guests: ['Andre Coleman'],
    source: 'Winter Archive Audit.csv', shortSynopsis: 'A winter field guide to the birds living alongside commuters in the city.',
    longSynopsis: 'Naturalist Andre Coleman identifies the calls and habits of common winter birds during a dawn walk from the river to the central station.',
    sensitiveNotes: [], dateNotes: [],
  },
];

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asDate = (value: string) => new Date(`${value}T12:00:00`);
const formatDate = (value: string) => { const d = asDate(value); return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const monthLabel = (value: string) => { const d = asDate(value); return `${monthNames[d.getMonth()]} ${d.getFullYear()}`; };
const monthKey = (value: string) => value.slice(0, 7);
const flagCount = (clip: Clip) => clip.sensitiveNotes.length + clip.dateNotes.length;

function Logo() {
  return <div className="viewer-brand"><span className="viewer-brand-mark">Re<span>·</span>Air Report</span></div>;
}

function Stat({ value, label, flagged }: { value: string | number; label: string; flagged?: boolean }) {
  return <div className={`viewer-stat${flagged ? ' flagged' : ''}`}><b>{value}</b><span>{label}</span></div>;
}

export function Current() {
  const [selectedId, setSelectedId] = useState(clips[0].id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [calendarMonth, setCalendarMonth] = useState('2025-04');

  const view = useMemo(() => clips.filter((clip) => {
    const haystack = [clip.id, ...clip.hosts, ...clip.guests, clip.shortSynopsis, clip.longSynopsis, ...clip.sensitiveNotes.map(n => n.text), ...clip.dateNotes.map(n => n.text)].join(' ').toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === 'review') return clip.sensitiveNotes.length > 0;
    if (filter === 'dates') return clip.dateNotes.length > 0;
    if (filter === 'clear') return flagCount(clip) === 0;
    return true;
  }).sort((a, b) => sort === 'id' ? a.id.localeCompare(b.id) : sort === 'old' ? a.date.localeCompare(b.date) : sort === 'flags' ? flagCount(b) - flagCount(a) : b.date.localeCompare(a.date)), [query, filter, sort]);
  const selected = clips.find(c => c.id === selectedId) ?? clips[0];
  const clear = () => { setQuery(''); setFilter('all'); setSort('new'); setCollapsed({}); };

  return <main className="reair-current min-h-screen">
    <header className="viewer-header">
      <div className="brand-lockup"><Logo /><span className="source-name">2 reports · Spring 2025 Re-Air Review.csv</span></div>
      <div className="header-stats"><Stat value={clips.length} label="clips" /><Stat value={3} label="need review" flagged /><Stat value={10} label="flags" /><Stat value="Jan 2025 – Apr 2025" label="clip dates" /></div>
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
    <div className="viewer-layout">
      <nav className={viewMode === 'list' ? 'clip-list' : 'calendar-pane'}>
        {viewMode === 'list'
          ? <ClipList clips={view} selectedId={selectedId} collapsed={collapsed} onCollapse={key => setCollapsed(old => ({ ...old, [key]: !old[key] }))} onSelect={setSelectedId} />
          : <Calendar clips={view} month={calendarMonth} setMonth={setCalendarMonth} selectedId={selectedId} onSelect={setSelectedId} />}
      </nav>
      <section className="clip-detail"><ClipDetail clip={selected} onSearch={setQuery} /></section>
    </div>
  </main>;
}

function ClipList({ clips: visible, selectedId, collapsed, onCollapse, onSelect }: { clips: Clip[]; selectedId: string; collapsed: Record<string, boolean>; onCollapse: (key: string) => void; onSelect: (id: string) => void }) {
  if (!visible.length) return <p className="empty-list">No clips match.<br />Clear the search or choose a different filter.</p>;
  let previous = '';
  return <div>{visible.map(clip => {
    const key = monthKey(clip.date); const show = key !== previous; previous = key;
    return <div key={clip.id}>{show && <button className="clip-group" aria-expanded={!collapsed[key]} onClick={() => onCollapse(key)}><span>{monthLabel(clip.date)}</span><ChevronRight className={collapsed[key] ? '' : 'expanded'} /></button>}
      {!collapsed[key] && <button className={`clip-item${flagCount(clip) ? '' : ' is-clear'}${selectedId === clip.id ? ' selected' : ''}`} onClick={() => onSelect(clip.id)}>
        <div><span className="clip-id">{clip.id}</span>{clip.revision && <span className="revision">{clip.revision}</span>}</div>
        <div className="clip-sub">{[...clip.hosts, ...clip.guests].join(', ')}</div>
        <div className="clip-airdate">Original airdate · {formatDate(clip.originalAir!)}</div>
        <div className="clip-pips">{clip.sensitiveNotes.length > 0 && <span className="pip amber"><i />{clip.sensitiveNotes.length} date-sensitive</span>}{clip.dateNotes.length > 0 && <span className="pip cyan"><i />{clip.dateNotes.length} dates</span>}{flagCount(clip) === 0 && <span className="pip clear"><i />no flags</span>}</div>
      </button>}</div>;
  })}</div>;
}

function Calendar({ clips: visible, month, setMonth, selectedId, onSelect }: { clips: Clip[]; month: string; setMonth: (m: string) => void; selectedId: string; onSelect: (id: string) => void }) {
  const [year, monthNo] = month.split('-').map(Number); const first = new Date(year, monthNo - 1, 1); const days = new Date(year, monthNo, 0).getDate();
  const shift = (delta: number) => { const d = new Date(year, monthNo - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`); };
  const byDay = new Map<number, Clip[]>(); visible.filter(c => monthKey(c.date) === month).forEach(c => { const d = asDate(c.date).getDate(); byDay.set(d, [...(byDay.get(d) ?? []), c]); });
  const current = new Date(year, monthNo - 1, 1);
  return <div className="calendar-view"><div className="calendar-header"><button className="icon-button" onClick={() => shift(-1)}><ChevronLeft /></button><h2>{monthNames[current.getMonth()]} {year}</h2><button className="icon-button" onClick={() => shift(1)}><ChevronRight /></button></div>
    <div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}</div>
    <div className="calendar-grid">{Array.from({length: first.getDay()},(_,i) => <span className="calendar-blank" key={`b${i}`} />)}{Array.from({length: days},(_,i) => { const day = i+1; const dayClips = byDay.get(day) ?? []; return <button key={day} className={`calendar-day${dayClips.length ? ' has-clips' : ''}${dayClips.some(c => c.id === selectedId) ? ' selected' : ''}`} onClick={() => dayClips[0] && onSelect(dayClips[0].id)}><span>{day}</span>{dayClips.length > 0 && <b>{dayClips.length}</b>}</button>; })}</div>
    <div className="calendar-day-heading">Clips in {monthNames[current.getMonth()]} {year}</div>
    <div className="calendar-day-clips">{visible.filter(c => monthKey(c.date) === month).map(c => <button key={c.id} className={`calendar-clip${selectedId === c.id ? ' selected' : ''}`} onClick={() => onSelect(c.id)}><strong>{c.id}</strong><span>{c.sensitiveNotes.length} review · {c.dateNotes.length} dates</span></button>)}</div>
  </div>;
}

function ClipDetail({ clip, onSearch }: { clip: Clip; onSearch: (q: string) => void }) {
  const notes = [...clip.sensitiveNotes, ...clip.dateNotes]; const span = 1800; const pos = (secs: number) => `${Math.min(100, secs / span * 100)}%`;
  return <div className="detail-pane">
    <div className="detail-top"><div><h1>{clip.id}</h1><div className="detail-sub">Clip date {formatDate(clip.date)}{clip.revision ? ` · ${clip.revision} version` : ''}{clip.time ? ` · ${clip.time}` : ''}</div></div><div className={`verdict ${clip.sensitiveNotes.length ? 'review' : 'clear'}`}><i />{clip.sensitiveNotes.length ? `Needs review — ${clip.sensitiveNotes.length} item${clip.sensitiveNotes.length > 1 ? 's' : ''}` : 'No date-sensitive items flagged'}</div></div>
    <dl className="clip-meta"><div><dt>Original air</dt><dd>{clip.originalAir ? formatDate(clip.originalAir) : 'Not listed'}</dd></div><div><dt>Last air</dt><dd>{clip.lastAir ? formatDate(clip.lastAir) : 'Not listed'}</dd></div><div><dt>Host</dt><dd>{clip.hosts.map(p => <button className="chip-link" key={p} onClick={() => onSearch(p)}>{p}</button>)}</dd></div><div><dt>Guests</dt><dd>{clip.guests.map(p => <button className="chip-link" key={p} onClick={() => onSearch(p)}>{p}</button>)}</dd></div><div><dt>Source report</dt><dd className="source-meta">{clip.source}</dd></div></dl>
    <section className="detail-section"><h2>Synopsis</h2><div className="synopsis"><div><h3>Short</h3><p>{clip.shortSynopsis}</p></div><div><h3>Full</h3><p>{clip.longSynopsis}</p></div></div></section>
    <section className="detail-section"><h2>Flag timeline</h2>{notes.length ? <><div className="timeline"><div className="timeline-inner"><div className="timeline-track" />{[0,300,600,900,1200,1500,1800].map(s => <div key={s}><span className={`timeline-tick${s % 600 ? ' minor' : ''}`} style={{left: pos(s)}} />{s % 600 === 0 && <span className="timeline-label" style={{left: pos(s)}}>{s/60}:00</span>}</div>)}<div className="timeline-lane top">{clip.sensitiveNotes.map(n => <span className="timeline-marker amber-marker" style={{left:pos(n.secs)}} key={n.tc}><span className="marker-stem" /><span className="marker-dot" /></span>)}</div><div className="timeline-lane bottom">{clip.dateNotes.map(n => <span className="timeline-marker cyan-marker" style={{left:pos(n.secs)}} key={n.tc}><span className="marker-dot" /><span className="marker-stem" /></span>)}</div></div></div><div className="timeline-legend"><span><i className="amber-dot" />above the line — date-sensitive material</span><span><i className="cyan-dot" />below the line — dates mentioned</span><span>scale 0:00 – 30:00</span></div></> : <div className="timeline-empty">No timecoded flags on this clip</div>}</section>
    {clip.sensitiveNotes.length > 0 && <Notes title="Date-sensitive material" notes={clip.sensitiveNotes} kind="amber" />}
    {clip.dateNotes.length > 0 && <Notes title="Dates mentioned" notes={clip.dateNotes} kind="cyan" />}
    <button className="btn print-button" onClick={() => window.print()}><Printer />Print clip sheet</button>
  </div>;
}

function Notes({ title, notes, kind }: { title: string; notes: Note[]; kind: 'amber' | 'cyan' }) {
  return <section className="detail-section"><h2>{title}<span className="note-count">{notes.length}</span></h2><div className="notes-grid">{notes.map(n => <div className={`note-card ${kind}`} key={n.tc}><span className="timecode">{n.tc}</span><p>{n.text}</p></div>)}</div></section>;
}