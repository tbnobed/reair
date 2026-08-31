import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, FilePlus2, Flag, LogOut, Search, SkipForward, UserRound } from 'lucide-react';
import './_group.css';
import './CommandCenter.css';

type Note = { tc: string; text: string; kind: 'risk' | 'date' };
type Clip = { id: string; date: string; originalAir: string; lastAir: string; hosts: string[]; guests: string[]; duration: string; short: string; full: string; notes: Note[]; source: string; status: 'urgent' | 'review' | 'clear' };

const clips: Clip[] = [
  { id: 'RA-2025-04-18-01', date: '2025-04-18', originalAir: '2024-10-11', lastAir: '2025-01-03', hosts: ['Mara Li'], guests: ['Dr. Elena Ruiz', 'Caleb Foster'], duration: '28:46', short: 'Coastal resilience, municipal planning, and communities adapting to a changing shoreline.', full: 'Mara Li speaks with urban ecologist Dr. Elena Ruiz and harbor planner Caleb Foster about preparation for stronger storm surges. The guests compare seawalls with restored wetlands, discuss the economics of relocation, and explain why neighborhood-level planning must begin years before construction.', source: 'Spring 2025 Re-Air Review.csv', status: 'urgent', notes: [{ tc: '04:18', kind: 'risk', text: 'Guest says the pilot project will open “this September.” Update or remove before rebroadcast.' }, { tc: '22:41', kind: 'risk', text: 'Host refers to the mayoral vote as happening “next week.” This is no longer current.' }, { tc: '08:06', kind: 'date', text: 'References Hurricane Sandy in October 2012.' }, { tc: '17:32', kind: 'date', text: 'Project funding period is identified as 2024 through 2027.' }] },
  { id: 'RA-2025-03-26-02', date: '2025-03-26', originalAir: '2024-03-02', lastAir: '2024-11-18', hosts: ['Owen Price'], guests: ['Fatima Bell'], duration: '31:10', short: 'An oral historian on preserving the stories and working life of a changing neighborhood.', full: 'Owen Price joins oral historian Fatima Bell on a walking tour through the East Market district. Bell shares recordings from shopkeepers and residents while describing the practical work of building a public archive.', source: 'Spring 2025 Re-Air Review.csv', status: 'urgent', notes: [{ tc: '02:09', kind: 'risk', text: 'Introduction calls the exhibition “currently on view.” Exhibition has closed.' }, { tc: '14:52', kind: 'date', text: 'Neighborhood association formed in 1978.' }, { tc: '26:03', kind: 'date', text: 'Archive began collecting interviews in 2019.' }] },
  { id: 'RA-2025-02-21-04', date: '2025-02-21', originalAir: '2024-02-21', lastAir: '2024-12-20', hosts: ['Mara Li'], guests: ['Imani Woods'], duration: '27:48', short: 'Chef Imani Woods traces a family recipe through migration, adaptation, and home kitchens.', full: 'Woods prepares a celebratory rice dish while explaining how ingredients and techniques changed as her family moved between regions. The conversation considers recipe cards as historical records.', source: 'Winter Archive Audit.csv', status: 'review', notes: [{ tc: '27:16', kind: 'risk', text: 'Closing promotes a restaurant residency ending this month.' }, { tc: '06:44', kind: 'date', text: 'Family arrived in Baltimore in 1966.' }] },
  { id: 'RA-2025-04-07-03', date: '2025-04-07', originalAir: '2023-06-22', lastAir: '2024-08-15', hosts: ['Mara Li'], guests: ['Nikhil Shah'], duration: '29:02', short: 'Composer Nikhil Shah turns field recordings into a new chamber work.', full: 'An in-studio performance and interview tracing sounds collected in train stations, markets, and workshops into a chamber composition.', source: 'Spring 2025 Re-Air Review.csv', status: 'review', notes: [{ tc: '12:14', kind: 'date', text: 'Mentions the album release date of June 30, 2023.' }] },
  { id: 'RA-2025-03-12-01', date: '2025-03-12', originalAir: '2022-09-09', lastAir: '2024-02-16', hosts: ['Owen Price'], guests: ['Leah Kim', 'Robert Vance'], duration: '26:35', short: 'Two conservators explain what centuries-old paper can reveal.', full: 'A visit to the paper conservation laboratory covers fibers, watermarks, inks, and repairs that allow rare manuscripts to be handled safely.', source: 'Spring 2025 Re-Air Review.csv', status: 'clear', notes: [] },
];

const format = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${d}T12:00:00`));

export function CommandCenter() {
  const [active, setActive] = useState(clips[0].id);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'queue' | 'archive'>('queue');
  const [done, setDone] = useState<string[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [notice, setNotice] = useState('');
  const queue = useMemo(() => clips.filter(c => !done.includes(c.id) && (mode === 'archive' || c.status !== 'clear') && [c.id, ...c.hosts, ...c.guests, c.short, ...c.notes.map(n => n.text)].join(' ').toLowerCase().includes(query.toLowerCase())), [done, mode, query]);
  const clip = clips.find(c => c.id === active && !done.includes(c.id)) ?? queue[0] ?? clips[0];
  const risks = clip.notes.filter(n => n.kind === 'risk');
  const finish = () => { setDone(old => [...old, clip.id]); setNotice(`${clip.id} marked reviewed`); setShowFull(false); };
  return <main className="reair-command">
    <header className="cc-topbar">
      <div className="cc-brand"><span className="cc-signal" /><span>RE·AIR</span><b>REVIEW DESK</b></div>
      <div className="cc-shift"><span>LIVE SHIFT</span><strong>Friday · Apr 18</strong><i>09:42 ET</i></div>
      <button className="cc-user" onClick={() => setNotice('Signed in as Administrator')}><UserRound /> Administrator <ChevronDown /></button>
      <button className="cc-icon" aria-label="Add report" onClick={() => setNotice('Report intake is ready')}><FilePlus2 /></button>
      <button className="cc-icon" aria-label="Sign out" onClick={() => setNotice('Sign out action staged')}><LogOut /></button>
    </header>
    <section className="cc-command">
      <div><p className="eyebrow">REVIEW COMMAND CENTER</p><h1>Hold the line on<br /><em>what has changed.</em></h1></div>
      <div className="cc-metrics"><Metric n={`${queue.length}`} l="IN ACTIVE QUEUE" /><Metric n={`${queue.filter(c => c.status === 'urgent').length}`} l="URGENT HOLDS" alert /><Metric n="10" l="DATES MENTIONED" /><Metric n="2" l="SOURCE REPORTS" /></div>
      <label className="cc-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search archive, people, evidence" /><kbd>/</kbd></label>
    </section>
    <div className="cc-workspace">
      <aside className="cc-queue">
        <div className="cc-tabs"><button className={mode === 'queue' ? 'active' : ''} onClick={() => setMode('queue')}>Priority queue</button><button className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>Archive</button></div>
        <div className="cc-queue-head"><span>{mode === 'queue' ? 'UNRESOLVED WORK' : 'SHARED ARCHIVE'}</span><span>{queue.length} clips</span></div>
        <div className="cc-list">{queue.length ? queue.map((c, i) => <button key={c.id} className={`cc-item ${c.id === clip.id ? 'selected' : ''}`} onClick={() => { setActive(c.id); setShowFull(false); }}><span className={`cc-rank ${c.status}`}>{String(i + 1).padStart(2, '0')}</span><div><strong>{c.id}</strong><p>{c.short}</p><small>{c.hosts.join(', ')} · aired {format(c.originalAir)}</small></div><span className="cc-item-count">{c.notes.length || '—'}</span></button>) : <div className="cc-empty"><Check />Queue cleared<br /><span>Shift work is caught up.</span></div>}</div>
        <button className="cc-archive-link" onClick={() => setMode('archive')}><CalendarDays /> Browse by air date <ChevronRight /></button>
      </aside>
      <section className="cc-case">
        <div className="cc-case-top"><div><p className="eyebrow">NOW REVIEWING · {clip.status === 'urgent' ? 'URGENT HOLD' : clip.status.toUpperCase()}</p><h2>{clip.id}</h2><span>{clip.duration} runtime · clip date {format(clip.date)}</span></div><div className="cc-case-actions"><button className="cc-button secondary" onClick={() => setNotice(`Skipped ${clip.id}; it remains in the queue`)}><SkipForward /> Skip</button><button className="cc-button complete" onClick={finish}><Check /> Mark reviewed</button></div></div>
        <div className="cc-context"><div><label>ORIGINAL AIR</label><b>{format(clip.originalAir)}</b></div><div><label>LAST AIR</label><b>{format(clip.lastAir)}</b></div><div><label>HOST / GUESTS</label><b>{[...clip.hosts, ...clip.guests].join(' · ')}</b></div><div><label>SOURCE</label><b>{clip.source}</b></div></div>
        <div className="cc-evidence-title"><div><Flag /><div><p className="eyebrow">EVIDENCE REGISTER</p><h3>{risks.length ? `${risks.length} broadcast hold${risks.length > 1 ? 's' : ''} require a decision` : 'No active broadcast holds'}</h3></div></div><button onClick={() => setNotice('Report incident form staged')}><AlertTriangle /> Report issue</button></div>
        <div className="cc-timeline"><div className="cc-line" />{clip.notes.map((n, i) => <button key={`${n.tc}${n.kind}`} className={`cc-pin ${n.kind}`} style={{ left: `${10 + i * (75 / Math.max(1, clip.notes.length - 1))}%` }} onClick={() => setNotice(`Jumped to ${n.tc}`)}><span>{n.tc}</span><i /></button>)}<small>00:00</small><small>10:00</small><small>20:00</small><small>{clip.duration}</small></div>
        <div className="cc-evidence">{clip.notes.length ? clip.notes.map(n => <article className={`cc-note ${n.kind}`} key={`${n.tc}-${n.text}`}><div><span className="cc-tc"><Clock3 /> {n.tc}</span><span className="cc-kind">{n.kind === 'risk' ? 'DATE-SENSITIVE' : 'DATE MENTIONED'}</span></div><p>{n.text}</p><button onClick={() => setNotice(`Evidence at ${n.tc} queued for review`)}>Inspect <ChevronRight /></button></article>) : <div className="cc-no-evidence"><Check /> No timecoded flags were found in this clip.</div>}</div>
        <section className="cc-synopsis"><div className="cc-section-label">SYNOPSIS</div><p>{showFull ? clip.full : clip.short}</p><button onClick={() => setShowFull(v => !v)}>{showFull ? 'Show short synopsis' : 'Read full context'} <ChevronRight /></button></section>
      </section>
    </div>
    {notice && <button className="cc-toast" onClick={() => setNotice('')}><Check /> {notice}</button>}
  </main>;
}

function Metric({ n, l, alert }: { n: string; l: string; alert?: boolean }) { return <div className={alert ? 'alert' : ''}><strong>{n}</strong><span>{l}</span></div>; }