import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FilePlus2,
  Flag,
  FolderOpen,
  LoaderCircle,
  LogOut,
  Printer,
  Radio,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  getListUsersQueryKey,
  getGetCurrentUserQueryKey,
  getListClipsQueryKey,
  getListReportsQueryKey,
  useCreateUser,
  useDeleteReport,
  useDeleteUser,
  useGetCurrentUser,
  useListClips,
  useListReports,
  useListUsers,
  useLogin,
  useLogout,
  useUploadReport,
  type Clip,
  type Report,
  type User,
} from '@workspace/api-client-react';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

type FilterKey = 'all' | 'review' | 'dates' | 'clear';
type SortKey = 'new' | 'old' | 'flags' | 'id';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | null | undefined) {
  const parsed = dateValue(value);
  return parsed ? `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}` : value || 'Not listed';
}

function formatDateSpan(clips: Clip[]) {
  const dates = clips.map((clip) => dateValue(clip.date)).filter((value): value is Date => Boolean(value)).sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return '—';
  return `${monthNames[dates[0].getMonth()]} ${dates[0].getFullYear()} – ${monthNames[dates[dates.length - 1].getMonth()]} ${dates[dates.length - 1].getFullYear()}`;
}

function textForClip(clip: Clip) {
  return [
    clip.id,
    clip.source,
    clip.shortSynopsis,
    clip.longSynopsis,
    ...clip.hosts,
    ...clip.guests,
    ...clip.sensitiveNotes.map((note) => note.text),
    ...clip.dateNotes.map((note) => note.text),
  ].join(' ').toLowerCase();
}

function highlight(value: string, query: string) {
  if (!query) return value;
  const parts = value.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((part, index) => part.toLowerCase() === query.toLowerCase()
    ? <mark key={`${part}-${index}`}>{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>);
}

function noteDomId(kind: 'amber' | 'cyan', index: number) {
  return `note-${kind}-${index}`;
}

function Logo() {
  return <div className="viewer-brand" data-testid="brand-reair">
    <span className="viewer-brand-mark">Re<span>·</span>Air Report</span>
  </div>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <RoutedErrorBoundary>
          <SessionRouter />
        </RoutedErrorBoundary>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}

function SessionRouter() {
  const [location] = useLocation();
  const { data: session, isLoading, isError } = useGetCurrentUser();

  if (isLoading) return <div className="auth-loading"><LoaderCircle className="spin" /> Checking your desk session</div>;
  if (isError || !session?.authenticated) return <AuthPage />;
  if (location === '/login') return <RedirectToWorkspace />;

  return <Switch>
    <Route path="/" component={Workspace} />
    <Route component={NotFound} />
  </Switch>;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function RedirectToWorkspace() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/'), [setLocation]);
  return <div className="auth-loading"><LoaderCircle className="spin" /> Opening your report desk</div>;
}

function AuthPage() {
  const [, setLocation] = useLocation();
  const localQueryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useLogin();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    login.mutate({ data: { email: email.trim(), password } }, {
      onSuccess: (session) => {
        localQueryClient.setQueryData(getGetCurrentUserQueryKey(), { authenticated: true, user: session.user });
        setLocation('/');
      },
      onError: () => setError('Unable to sign in with those credentials.'),
    });
  };

  return <main className="auth-screen">
    <div className="auth-card">
      <Logo />
      <div className="auth-copy">
        <p className="eyebrow">Private review workstation</p>
        <h1>Sign in to Re-Air.</h1>
        <p>Access the report archive on your own infrastructure.</p>
      </div>
      <form onSubmit={submit} className="auth-form" noValidate>
        <label>Email address<input data-testid="input-auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@station.org" /></label>
        <label>Password<input data-testid="input-auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        {error && <div className="inline-error" data-testid="status-auth-error"><AlertCircle />{error}</div>}
        <button data-testid="button-auth-submit" className="btn primary wide" type="submit" disabled={login.isPending}>
          {login.isPending ? <LoaderCircle className="spin" /> : <LogOut className="enter-icon" />}
          {login.isPending ? 'Checking credentials…' : 'Enter report desk'}
        </button>
      </form>
    </div>
  </main>;
}

function Workspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('new');
  const [showReports, setShowReports] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const localQueryClient = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const { data: reports = [], isLoading: reportsLoading } = useListReports();
  const { data: clips = [], isLoading: clipsLoading, isError: clipsError, refetch: refetchClips } = useListClips();
  const logout = useLogout();

  const view = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clips.filter((clip) => {
      if (normalized && !textForClip(clip).includes(normalized)) return false;
      if (filter === 'review') return clip.sensitiveNotes.length > 0;
      if (filter === 'dates') return clip.dateNotes.length > 0;
      if (filter === 'clear') return clip.flagCount === 0;
      return true;
    }).sort((left, right) => {
      if (sort === 'flags') return right.flagCount - left.flagCount || (dateValue(right.date)?.getTime() ?? 0) - (dateValue(left.date)?.getTime() ?? 0);
      if (sort === 'old') return (dateValue(left.date)?.getTime() ?? 0) - (dateValue(right.date)?.getTime() ?? 0);
      if (sort === 'id') return left.id.localeCompare(right.id);
      return (dateValue(right.date)?.getTime() ?? 0) - (dateValue(left.date)?.getTime() ?? 0);
    });
  }, [clips, filter, query, sort]);

  useEffect(() => {
    if (selectedId && view.some((clip) => clip.id === selectedId)) return;
    setSelectedId(view[0]?.id ?? null);
  }, [selectedId, view]);

  const selectClip = (id: string, revealOnMobile = true) => {
    setSelectedId(id);
    if (revealOnMobile && window.innerWidth <= 900) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName);
      if (typing || !['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key) || !view.length) return;
      event.preventDefault();
      const currentIndex = view.findIndex((clip) => clip.id === selectedId);
      const step = event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(view.length - 1, currentIndex < 0 ? 0 : currentIndex + step));
      const next = view[nextIndex];
      selectClip(next.id, false);
      requestAnimationFrame(() => {
        document.querySelector(`[data-clip-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
        if (window.innerWidth <= 900) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedId, view]);

  const selected = clips.find((clip) => clip.id === selectedId) ?? null;
  const totalFlags = clips.reduce((total, clip) => total + clip.flagCount, 0);
  const reviewed = clips.filter((clip) => clip.sensitiveNotes.length > 0).length;
  const sourceLabel = reports.length > 1
    ? `${reports.length} reports · ${reports[reports.length - 1]?.name || 'archive'}`
    : reports[0]?.name || (reportsLoading ? 'Loading report archive…' : 'No report loaded');

  const clearView = () => {
    setQuery('');
    setFilter('all');
    setSort('new');
    setSelectedId(null);
  };

  const signOut = () => logout.mutate(undefined, {
    onSuccess: () => localQueryClient.setQueryData(getGetCurrentUserQueryKey(), { authenticated: false, user: null }),
  });

  return <main className="viewer-shell">
    <header className="viewer-header">
      <div className="brand-lockup"><Logo /><span className="source-name" title={sourceLabel}>{sourceLabel}</span></div>
      <div className="header-stats">
        {reports.length > 1 && <Stat value={reports.length} label="reports" />}
        <Stat value={clips.length} label="clips" />
        <Stat value={reviewed} label="need review" flagged />
        <Stat value={totalFlags} label="flags" />
        <Stat value={formatDateSpan(clips)} label="clip dates" wide />
      </div>
      {session?.user?.isAdmin && <button className="btn" data-testid="button-manage-users" onClick={() => setShowUsers(true)}><Users /> Users</button>}
      <button className="btn" data-testid="button-upload-report" onClick={() => setShowReports(true)}><FilePlus2 /> Add report</button>
      <button className="btn ghost" data-testid="button-clear-view" onClick={clearView} disabled={!clips.length && !query}>Clear</button>
      <button className="btn ghost header-signout" data-testid="button-sign-out" onClick={signOut}><LogOut /> Sign out</button>
    </header>

    <ViewerToolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} count={view.length} total={clips.length} onClear={clearView} />

    <div className="viewer-layout">
      <nav className="clip-list" aria-label="Clips">
        {clipsLoading ? <div className="empty-list"><LoaderCircle className="spin" /> Loading clips…</div> : clipsError ? <div className="empty-list"><p>Could not load clips.</p><button className="btn" onClick={() => void refetchClips()}>Retry</button></div> : <ClipList clips={view} query={query} selectedId={selectedId} onSelect={selectClip} hasClips={clips.length > 0} />}
      </nav>
      <section ref={detailRef} className="clip-detail" aria-live="polite">
        {selected ? <ClipDetail clip={selected} query={query} onSearch={setQuery} /> : <Placeholder hasClips={clips.length > 0} />}
      </section>
    </div>

    {showReports && <ReportManager reports={reports} onClose={() => setShowReports(false)} />}
    {showUsers && session?.user?.isAdmin && <UserManager currentUserId={session.user.id} onClose={() => setShowUsers(false)} />}
  </main>;
}

function Stat({ value, label, flagged = false, wide = false }: { value: number | string; label: string; flagged?: boolean; wide?: boolean }) {
  return <div className={`viewer-stat${flagged ? ' flagged' : ''}${wide ? ' span' : ''}`}><b>{value}</b><span>{label}</span></div>;
}

function ViewerToolbar({ query, setQuery, filter, setFilter, sort, setSort, count, total, onClear }: {
  query: string;
  setQuery: (value: string) => void;
  filter: FilterKey;
  setFilter: (value: FilterKey) => void;
  sort: SortKey;
  setSort: (value: SortKey) => void;
  count: number;
  total: number;
  onClear: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setQuery('');
        onClear();
        searchRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClear, setQuery]);

  return <div className="viewer-toolbar">
    <label className="viewer-search"><Search /><input ref={searchRef} data-testid="input-clip-search" type="search" aria-label="Search clips" placeholder="Search clip ID, people, synopsis, flags" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>/</kbd></label>
    <div className="segmented" role="group" aria-label="Filter clips">
      {([['all', 'All'], ['review', 'Needs review'], ['dates', 'Dates mentioned'], ['clear', 'No flags']] as [FilterKey, string][]).map(([key, label]) => <button key={key} data-f={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    <select data-testid="select-clip-sort" aria-label="Sort clips" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
      <option value="new">Newest clip date</option>
      <option value="old">Oldest clip date</option>
      <option value="flags">Most flags</option>
      <option value="id">Clip ID A–Z</option>
    </select>
    <span className="result-count">{count === total ? `${total} clips` : `${count} of ${total} clips`}</span>
  </div>;
}

function ClipList({ clips, query, selectedId, onSelect, hasClips }: { clips: Clip[]; query: string; selectedId: string | null; onSelect: (id: string) => void; hasClips: boolean }) {
  if (!clips.length) return <p className="empty-list">{hasClips ? <>No clips match.<br />Clear the search or choose a different filter.</> : <>No report loaded.<br />Add a report to start.</>}</p>;
  let lastGroup = '';
  return <div>{clips.map((clip) => {
    const parsed = dateValue(clip.date);
    const group = parsed ? `${monthNames[parsed.getMonth()]} ${parsed.getFullYear()}` : 'No date in clip ID';
    const showGroup = group !== lastGroup;
    lastGroup = group;
    const people = [...clip.hosts, ...clip.guests].join(', ');
    const sub = people || (clip.originalAir ? `Aired ${formatDate(clip.originalAir)}` : 'No people listed');
    return <div key={clip.id}>
      {showGroup && <div className="clip-group">{group}</div>}
      <button data-clip-id={clip.id} className={`clip-item${clip.flagCount ? '' : ' is-clear'}${selectedId === clip.id ? ' selected' : ''}`} aria-current={selectedId === clip.id} onClick={() => onSelect(clip.id)}>
        <div><span className="clip-id">{highlight(clip.id, query)}</span>{clip.revision && <span className="revision">{clip.revision}</span>}</div>
        <div className="clip-sub">{highlight(sub, query)}</div>
        <div className="clip-pips">
          {clip.sensitiveNotes.length > 0 && <span className="pip amber"><i />{clip.sensitiveNotes.length} date-sensitive</span>}
          {clip.dateNotes.length > 0 && <span className="pip cyan"><i />{clip.dateNotes.length} dates</span>}
          {clip.flagCount === 0 && <span className="pip clear"><i />no flags</span>}
        </div>
      </button>
    </div>;
  })}</div>;
}

function Placeholder({ hasClips }: { hasClips: boolean }) {
  return <div className="placeholder">
    <div className="placeholder-big">{hasClips ? 'Select a clip' : 'Load a re-air report'}</div>
    <p>{hasClips ? 'Pick a clip on the left to see its flags, people, and synopsis.' : 'Use Add report to load a CSV into the searchable archive.'}</p>
    <div className="key-help"><kbd>↑</kbd> <kbd>↓</kbd> move&nbsp;&nbsp; <kbd>/</kbd> search&nbsp;&nbsp; <kbd>Esc</kbd> clear</div>
  </div>;
}

function ClipDetail({ clip, query, onSearch }: { clip: Clip; query: string; onSearch: (value: string) => void }) {
  const allNotes = [...clip.sensitiveNotes, ...clip.dateNotes].filter((note) => note.secs !== null);
  const maxSeconds = Math.max(0, ...allNotes.map((note) => note.secs ?? 0));
  const timelineSpan = Math.max(1800, Math.ceil((maxSeconds + 120) / 300) * 300);
  const position = (seconds: number) => `${(seconds / timelineSpan * 100).toFixed(3)}%`;
  const jumpToNote = (kind: 'amber' | 'cyan', index: number) => document.getElementById(noteDomId(kind, index))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const metadata = [
    { label: 'Original air', value: clip.originalAir ? formatDate(clip.originalAir) : null },
    { label: 'Last air', value: clip.lastAir ? formatDate(clip.lastAir) : null },
  ];

  return <div className="detail-pane">
    <div className="detail-top">
      <div><h1>{highlight(clip.id, query)}</h1><div className="detail-sub">{clip.date ? `Clip date ${formatDate(clip.date)}` : 'No date encoded in clip ID'}{clip.revision ? ` · ${clip.revision} version` : ''}{clip.time ? ` · ${clip.time}` : ''}</div></div>
      <div className={`verdict ${clip.sensitiveNotes.length ? 'review' : 'clear'}`}><i />{clip.sensitiveNotes.length ? `Needs review — ${clip.sensitiveNotes.length} item${clip.sensitiveNotes.length > 1 ? 's' : ''}` : 'No date-sensitive items flagged'}</div>
    </div>

    <dl className="clip-meta">
      {metadata.map((item) => <div key={item.label}><dt>{item.label}</dt><dd className={!item.value ? 'none' : ''}>{item.value || 'Not listed'}</dd></div>)}
      <div><dt>Host</dt><dd>{clip.hosts.length ? clip.hosts.map((person) => <button className="chip-link" key={person} onClick={() => onSearch(person)}>{highlight(person, query)}</button>) : <span className="none">Not listed</span>}</dd></div>
      <div><dt>Guests</dt><dd>{clip.guests.length ? clip.guests.map((person) => <button className="chip-link" key={person} onClick={() => onSearch(person)}>{highlight(person, query)}</button>) : <span className="none">Not listed</span>}</dd></div>
      {clip.source && <div><dt>Source report</dt><dd className="source-meta">{clip.source}</dd></div>}
    </dl>

    <section className="detail-section">
      <h2>Flag timeline</h2>
      {allNotes.length ? <><div className="timeline">
        <div className="timeline-inner"><div className="timeline-track" />
          {Array.from({ length: Math.floor(timelineSpan / 300) + 1 }, (_, index) => {
            const seconds = index * 300;
            return <div key={seconds}><span className={`timeline-tick${seconds % 600 ? ' minor' : ''}`} style={{ left: position(seconds) }} />{seconds % 600 === 0 && <span className="timeline-label" style={{ left: position(seconds) }}>{Math.floor(seconds / 60)}:00</span>}</div>;
          })}
          <div className="timeline-lane top">{clip.sensitiveNotes.map((note, index) => note.secs !== null && <button key={`${note.tc}-${index}`} className="timeline-marker amber-marker" style={{ left: position(note.secs) }} onClick={() => jumpToNote('amber', index)} title={`${note.tc} — ${note.text}`} aria-label={`${note.tc}: ${note.text}`}><span className="marker-stem" /><span className="marker-dot" /></button>)}</div>
          <div className="timeline-lane bottom">{clip.dateNotes.map((note, index) => note.secs !== null && <button key={`${note.tc}-${index}`} className="timeline-marker cyan-marker" style={{ left: position(note.secs) }} onClick={() => jumpToNote('cyan', index)} title={`${note.tc} — ${note.text}`} aria-label={`${note.tc}: ${note.text}`}><span className="marker-dot" /><span className="marker-stem" /></button>)}</div>
        </div>
      </div><div className="timeline-legend"><span><i className="amber-dot" />above the line — date-sensitive material</span><span><i className="cyan-dot" />below the line — dates mentioned</span><span>scale 0:00 – {Math.floor(timelineSpan / 60)}:00</span></div></> : <div className="timeline-empty">No timecoded flags on this clip</div>}
    </section>

    {clip.sensitiveNotes.length > 0 && <NoteSection title="Date-sensitive material" notes={clip.sensitiveNotes} kind="amber" query={query} />}
    {clip.dateNotes.length > 0 && <NoteSection title="Dates mentioned" notes={clip.dateNotes} kind="cyan" query={query} />}

    <section className="detail-section">
      <h2>Synopsis</h2>
      <div className="synopsis">
        <div><h3>Short</h3><p>{clip.shortSynopsis ? highlight(clip.shortSynopsis, query) : <span className="none">Not provided in this report.</span>}</p></div>
        <div className="synopsis-full"><h3>Full</h3><p>{clip.longSynopsis ? highlight(clip.longSynopsis, query) : <span className="none">{clip.duplicateLongSynopsis ? 'This report repeats the short synopsis here.' : 'Not provided in this report.'}</span>}</p></div>
      </div>
    </section>

    <button className="btn print-button" onClick={() => window.print()}><Printer /> Print clip sheet</button>
  </div>;
}

function NoteSection({ title, notes, kind, query }: { title: string; notes: Clip['sensitiveNotes']; kind: 'amber' | 'cyan'; query: string }) {
  return <section className="detail-section">
    <h2>{title} <span className="note-count">{notes.length}</span></h2>
    <div className="notes-grid">{notes.map((note, index) => <div className={`note-card ${kind}`} id={noteDomId(kind, index)} key={`${note.tc}-${index}`}>
      {note.tc ? <button className="timecode" onClick={() => document.getElementById(noteDomId(kind, index))?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>{note.tc}</button> : <span className="timecode blank">—</span>}
      <p>{highlight(note.text, query)}</p>
    </div>)}</div>
  </section>;
}

function ReportManager({ reports, onClose }: { reports: Report[]; onClose: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const localQueryClient = useQueryClient();
  const remove = useDeleteReport();
  const upload = useUploadReport();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    if (next && !next.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file.');
      setFile(null);
      return;
    }
    setError('');
    setFile(next);
    if (next && !name) setName(next.name.replace(/\.csv$/i, ''));
  };

  const submit = () => {
    if (!file || !name.trim()) {
      setError('Choose a CSV file and give this report a name.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ data: { name: name.trim(), content: String(reader.result ?? '') } }, {
      onSuccess: () => {
        void localQueryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        void localQueryClient.invalidateQueries({ queryKey: getListClipsQueryKey() });
        setUploadOpen(false);
        setFile(null);
        setName('');
      },
      onError: () => setError('Upload failed. Check the CSV and try again.'),
    });
    reader.onerror = () => setError('The browser could not read that file.');
    reader.readAsText(file);
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reports-dialog-title">
    <div className="reports-modal">
      <div className="modal-header"><div><p className="eyebrow">Archive / sources</p><h2 id="reports-dialog-title">Report archive</h2></div><button className="icon-button" aria-label="Close report archive" onClick={onClose}><X /></button></div>
      {uploadOpen ? <div className="upload-panel">
        <label>Report name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Morning news / 2024-06" /></label>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={chooseFile} hidden />
        <button className="file-picker" onClick={() => fileRef.current?.click()}><Upload />{file?.name || 'Choose a CSV file'}</button>
        {error && <div className="inline-error"><AlertCircle />{error}</div>}
        <div className="modal-actions"><button className="btn ghost" onClick={() => setUploadOpen(false)}>Cancel</button><button className="btn primary" onClick={submit} disabled={upload.isPending}>{upload.isPending ? <LoaderCircle className="spin" /> : <Check />} Upload and index</button></div>
      </div> : <>
        <div className="modal-actions top-actions"><button className="btn primary" onClick={() => { setUploadOpen(true); setError(''); }}><Upload /> Add report</button></div>
        {reports.length ? <div className="report-rows">{reports.map((report) => <div className="report-row" key={report.id}><div><strong>{report.name}</strong><span>{report.clipCount} clips · uploaded {formatDate(report.uploadedAt)}</span></div><button className="icon-button danger" aria-label={`Delete ${report.name}`} onClick={() => { if (window.confirm(`Delete ${report.name} and its clips?`)) remove.mutate({ reportId: report.id }, { onSuccess: () => { void localQueryClient.invalidateQueries({ queryKey: getListReportsQueryKey() }); void localQueryClient.invalidateQueries({ queryKey: getListClipsQueryKey() }); } }); }}><Trash2 /></button></div>)}</div> : <div className="modal-empty">No report loaded yet. Add a CSV export to start.</div>}
      </>}
    </div>
  </div>;
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.replace(/^HTTP \d+(?: [^:]*)?:\s*/, '').trim();
  return message || fallback;
}

function UserManager({ currentUserId, onClose }: { currentUserId: number; onClose: () => void }) {
  const localQueryClient = useQueryClient();
  const { data: users = [], isLoading, isError, refetch } = useListUsers();
  const create = useCreateUser();
  const remove = useDeleteUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    create.mutate({ data: { email: normalizedEmail, password } }, {
      onSuccess: () => {
        setEmail('');
        setPassword('');
        void localQueryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (nextError) => setError(mutationErrorMessage(nextError, 'The user could not be created.')),
    });
  };

  const deleteAccount = (user: User) => {
    if (!window.confirm(`Delete ${user.email}? Their reports and sessions will also be removed.`)) return;
    setError('');
    remove.mutate({ userId: user.id }, {
      onSuccess: () => void localQueryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
      onError: (nextError) => setError(mutationErrorMessage(nextError, 'The user could not be deleted.')),
    });
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="users-dialog-title">
    <div className="reports-modal users-modal">
      <div className="modal-header"><div><p className="eyebrow">Administration</p><h2 id="users-dialog-title">Users</h2></div><button className="icon-button" aria-label="Close user management" onClick={onClose}><X /></button></div>
      <form className="upload-panel user-create-form" onSubmit={submit} noValidate>
        <label>Email address<input data-testid="input-new-user-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@station.org" /></label>
        <label>Temporary password<input data-testid="input-new-user-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        {error && <div className="inline-error" data-testid="status-user-error"><AlertCircle />{error}</div>}
        <div className="modal-actions"><button data-testid="button-create-user" className="btn primary" type="submit" disabled={create.isPending}>{create.isPending ? <LoaderCircle className="spin" /> : <UserPlus />}{create.isPending ? 'Creating…' : 'Create user'}</button></div>
      </form>
      <div className="user-list-heading"><span>Existing accounts</span><b>{users.length}</b></div>
      {isLoading ? <div className="modal-empty"><LoaderCircle className="spin" /> Loading users…</div>
        : isError ? <div className="modal-empty"><p>Could not load users.</p><button className="btn" onClick={() => void refetch()}>Retry</button></div>
          : <div className="report-rows user-rows">{users.map((user) => <div className="report-row user-row" data-testid={`user-row-${user.id}`} key={user.id}>
            <div><strong>{user.email}{user.isAdmin && <span className="admin-badge">Admin</span>}</strong><span>Created {formatDate(user.createdAt)}</span></div>
            {user.id === currentUserId ? <span className="current-user-label">Current account</span> : <button className="icon-button danger" aria-label={`Delete ${user.email}`} disabled={remove.isPending} onClick={() => deleteAccount(user)}><Trash2 /></button>}
          </div>)}</div>}
    </div>
  </div>;
}

export default App;