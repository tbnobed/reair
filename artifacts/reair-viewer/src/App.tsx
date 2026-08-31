import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
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
  UserRound,
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
  useUpdateUserRole,
  useUploadReport,
  type Clip,
  type Report,
  type User,
  type UserRole,
} from '@workspace/api-client-react';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@workspace/reair-review-system/components/ui/toaster';
import { TooltipProvider } from '@workspace/reair-review-system/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@workspace/reair-review-system/components/ui/alert';
import { Badge } from '@workspace/reair-review-system/components/ui/badge';
import { Button } from '@workspace/reair-review-system/components/ui/button';
import { Card, CardContent } from '@workspace/reair-review-system/components/ui/card';
import { Input } from '@workspace/reair-review-system/components/ui/input';

const queryClient = new QueryClient();

type FilterKey = 'all' | 'review' | 'dates' | 'clear';
type SortKey = 'new' | 'old' | 'flags' | 'id';
type ArchiveView = 'list' | 'calendar';
type DispositionFilter = 'all' | 'Needs edit' | 'Hold for context' | 'Clear for re-air';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};
const roleDescriptions: Record<UserRole, string> = {
  admin: 'Manage users and imported data',
  editor: 'Upload and delete imported data',
  viewer: 'Read-only archive access',
};

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

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function monthLabel(value: Date) {
  return `${monthNames[value.getMonth()]} ${value.getFullYear()}`;
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function textForClip(clip: Clip) {
  return [
    clip.id,
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
    <span className="viewer-brand-mark">Re·Air / Praise</span>
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
  const { data: session, isLoading, isError } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  });

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
  return <div className="auth-loading"><LoaderCircle className="spin" /> Opening your archive</div>;
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
        <p>Access the Re-Air archive on your own infrastructure.</p>
      </div>
      <form onSubmit={submit} className="auth-form" noValidate>
        <label>Email address<input data-testid="input-auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@station.org" /></label>
        <label>Password<input data-testid="input-auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        {error && <div className="inline-error" data-testid="status-auth-error"><AlertCircle />{error}</div>}
        <button data-testid="button-auth-submit" className="btn primary wide" type="submit" disabled={login.isPending}>
          {login.isPending ? <LoaderCircle className="spin" /> : <LogOut className="enter-icon" />}
          {login.isPending ? 'Checking credentials…' : 'Enter archive'}
        </button>
      </form>
    </div>
  </main>;
}

function Workspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [dispositionFilter, setDispositionFilter] = useState<DispositionFilter>('all');
  const [sort, setSort] = useState<SortKey>('new');
  const [showReports, setShowReports] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const localQueryClient = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const { data: reports = [] } = useListReports();
  const { data: clips = [], isLoading: clipsLoading, isError: clipsError, refetch: refetchClips } = useListClips();
  const logout = useLogout();
  const currentRole = session?.user?.role ?? 'viewer';
  const canEditReports = currentRole === 'admin' || currentRole === 'editor';

  const view = useMemo(() => {
    const filtered = clips
      .filter((clip) => textForClip(clip).includes(query.trim().toLowerCase()))
      .filter((clip) => dispositionFilter === 'all' || decisions[clip.id] === dispositionFilter);
    return filtered.sort((left, right) => {
      if (sort === 'id') return left.id.localeCompare(right.id);
      const leftDate = dateValue(left.originalAir || left.date)?.getTime() ?? 0;
      const rightDate = dateValue(right.originalAir || right.date)?.getTime() ?? 0;
      return sort === 'old' ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [clips, query, dispositionFilter, decisions, sort]);

  useEffect(() => {
    if (selectedId && view.some((clip) => clip.id === selectedId)) return;
    setSelectedId(view[0]?.id ?? null);
  }, [selectedId, view]);

  const selected = view.find((clip) => clip.id === selectedId) ?? view[0] ?? null;
  const selectedIndex = Math.max(0, view.findIndex((clip) => clip.id === selected?.id));
  const reviewed = clips.filter((clip) => decisions[clip.id]).length;
  const signOut = () => logout.mutate(undefined, {
    onSuccess: () => localQueryClient.setQueryData(getGetCurrentUserQueryKey(), { authenticated: false, user: null }),
  });

  const nextClip = () => {
    if (!selected) return;
    const pending = view.findIndex((clip, index) => index > selectedIndex && !decisions[clip.id]);
    const nextIndex = pending >= 0 ? pending : Math.min(selectedIndex + 1, view.length - 1);
    setSelectedId(view[nextIndex]?.id ?? null);
  };

  const notes = selected ? [...selected.sensitiveNotes, ...selected.dateNotes] : [];
  const timedNotes = selected?.sensitiveNotes ?? [];
  const dateNotes = selected?.dateNotes ?? [];
  const people = selected ? [...selected.hosts, ...selected.guests] : [];

  return <main className="min-h-screen bg-background font-sans text-foreground">
    <header className="flex min-h-16 flex-wrap items-center gap-3 border-b-4 border-primary bg-sidebar px-4 py-3 text-sidebar-foreground sm:px-7">
      <div className="whitespace-nowrap font-serif text-sm font-bold uppercase tracking-[0.16em]">Re·Air / Praise</div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer /> Print sheet</Button>
        <Button variant="secondary" size="sm" onClick={() => setShowReports(true)}>{canEditReports ? <FilePlus2 /> : <FolderOpen />}<span className="hidden sm:inline">{canEditReports ? 'Add data' : 'Data'}</span></Button>
        {currentRole === 'admin' && <Button variant="secondary" size="sm" onClick={() => setShowUsers(true)}><Users /><span className="hidden sm:inline">Users</span></Button>}
        <Button variant="secondary" size="icon" aria-label={`Sign out ${roleLabels[currentRole]}`} onClick={signOut}><UserRound /></Button>
      </div>
    </header>

    {clipsLoading || clipsError || !selected ? <section className="grid min-h-[calc(100vh-4rem)] place-items-center bg-card px-6 text-center">
      <div className="max-w-lg">
        <p className="font-serif text-xs font-bold uppercase tracking-[0.18em] text-primary">Archive connection</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">{clipsLoading ? 'Loading live archive' : clipsError ? 'Archive unavailable' : 'Your archive is empty'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{clipsLoading ? 'Loading your Re-Air archive…' : clipsError ? 'Your Re-Air archive could not be loaded.' : 'Add a CSV to begin guided review.'}</p>
        {clipsError && <Button className="mt-5" onClick={() => void refetchClips()}>Retry archive</Button>}
        {!clipsLoading && !clipsError && canEditReports && <Button className="mt-5" onClick={() => setShowReports(true)}>Add data</Button>}
      </div>
    </section> : <>
      <section className="grid items-center gap-4 border-b bg-card px-4 py-3 sm:px-7 lg:grid-cols-[1fr_minmax(14rem,24rem)_auto]" aria-label="Review progress and disposition filters">
        <div />
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`${reviewed} of ${clips.length} clips reviewed`} aria-valuemin={0} aria-valuemax={clips.length} aria-valuenow={reviewed}>
            <div className="h-full bg-primary transition-[width]" style={{ width: `${clips.length ? reviewed / clips.length * 100 : 0}%` }} />
          </div>
        </div>
        <div className="font-mono text-xs">{reviewed} / {clips.length} resolved</div>
      </section>

       <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[26.25rem_minmax(0,1fr)] xl:grid-cols-[26.25rem_minmax(0,1fr)_47.5rem]">
        <aside className="bg-sidebar p-4 text-sidebar-foreground">
          <p className="px-1 font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/70">Review queue · real archive notes</p>
          <div className="mt-3 flex gap-2"><Input data-testid="input-clip-search" aria-label="Search review queue" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a clip or person" /><Button variant="secondary" size="icon" aria-label="Search"><Search /></Button></div>
          <div className="mt-3 grid gap-2 border-y border-sidebar-border py-3">
            <label className="flex items-center justify-between gap-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-sidebar-foreground/60" htmlFor="queue-sort">Sort queue
              <select id="queue-sort" aria-label="Sort queue" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-8 min-w-0 flex-1 border border-sidebar-border bg-sidebar px-2 font-mono text-[0.65rem] uppercase tracking-normal text-sidebar-foreground outline-none focus:border-sidebar-foreground">
                <option value="new">Newest airdate</option>
                <option value="old">Oldest airdate</option>
                <option value="id">Title / clip ID A–Z</option>
              </select>
            </label>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-sidebar-foreground/60">Filter by disposition</p>
            <div className="flex flex-wrap gap-1">
              {(['Needs edit', 'Hold for context', 'Clear for re-air'] as Exclude<DispositionFilter, 'all'>[]).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={dispositionFilter === option ? 'default' : 'outline'}
                  aria-pressed={dispositionFilter === option}
                  onClick={() => setDispositionFilter((current) => current === option ? 'all' : option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
           <div className="mt-3 h-[calc(100vh-14rem)] overflow-y-auto">
            <div className="grid gap-1 pr-3">{view.map((clip) => <Button key={clip.id} variant={selectedId === clip.id ? 'default' : 'ghost'} className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setSelectedId(clip.id); }}>
               <span className="min-w-0 wrap-text"><span className="block break-words font-mono text-xs">{clip.id}</span><span className="mt-1 block break-words text-xs leading-5 opacity-75">{[...clip.hosts, ...clip.guests].join(' · ') || 'Host / guests not recorded'}</span><span className="mt-1 block break-words font-mono text-[0.65rem] leading-5 opacity-65">Original airdate · {formatDate(clip.originalAir)}</span><span className="mt-1.5 block break-words font-mono text-[0.65rem] leading-5 opacity-80">{decisions[clip.id] ?? `${clip.flagCount} archive note${clip.flagCount === 1 ? '' : 's'}`}</span></span>
            </Button>)}</div>
          </div>
        </aside>

         <section className="min-w-0 max-h-[calc(100vh-9rem)] overflow-y-auto border-r border-border px-5 py-8 sm:px-8 lg:px-10 xl:px-12">
           <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><span className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-destructive">Now reviewing · clip {selectedIndex + 1} of {clips.length}</span><Button variant="ghost" size="sm" onClick={nextClip}>Skip to next <ChevronRight /></Button></div>
           <h1 className="mt-3 break-words font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{selected.id}</h1>
           <p className="mt-2 max-w-none wrap-text break-words text-base leading-7 text-muted-foreground">{selected.shortSynopsis || 'No short synopsis was provided.'}</p>

           <section className="mt-7 min-w-0 border-y border-border py-5">
            <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-primary">Full synopsis</h2>
             <p className="mt-3 max-w-none wrap-text break-words text-sm leading-7 text-muted-foreground">{selected.longSynopsis || 'No full synopsis was provided.'}</p>
          </section>

          <section className="mt-7 bg-secondary p-5 text-secondary-foreground">
            <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-primary">Editorial disposition</h2>
            <div className="mt-4 flex flex-wrap gap-2">{['Needs edit', 'Hold for context', 'Clear for re-air'].map((option) => <Button key={option} variant={decisions[selected.id] === option ? 'default' : 'outline'} onClick={() => setDecisions((current) => ({ ...current, [selected.id]: option }))}>{option}</Button>)}</div>
            {decisions[selected.id] && <p className="mt-3 text-xs opacity-70">Recorded locally as “{decisions[selected.id]}”. No archive data was changed.</p>}
          </section>
        </section>

         <aside className="min-w-0 max-h-[calc(100vh-9rem)] overflow-y-auto bg-muted p-5 lg:col-span-2 xl:col-span-1">
          <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Supporting context</h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
             {[['Original airdate', formatDate(selected.originalAir)], ['Last aired', formatDate(selected.lastAir)], ['Host / guests', people.join(' · ') || 'Not recorded']].map(([label, value]) => <div className="min-w-0 py-3" key={label}><dt className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt><dd className="mt-1 wrap-text break-words text-sm leading-5">{value}</dd></div>)}
          </dl>

           <div className="mt-6 grid min-w-0 gap-5 border-t border-border pt-5 xl:grid-cols-2">
             <section className="min-w-0">
              <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Timed material</h2>
               {timedNotes.length ? <div className="mt-3 grid gap-2">{timedNotes.map((note, index) => <Card key={`${note.tc}-${index}`}><CardContent className="grid min-w-0 gap-2 p-3"><Badge variant="destructive" className="w-fit">{note.tc || '—'}</Badge><p className="wrap-text break-words text-xs leading-5">{note.text}</p></CardContent></Card>)}</div> : <p className="mt-3 wrap-text break-words text-sm leading-6 text-muted-foreground">No timed notes were recorded for this clip.</p>}
            </section>
             <section className="min-w-0">
              <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Date notes</h2>
               {dateNotes.length ? <div className="mt-3 grid gap-2">{dateNotes.map((note, index) => <Card key={`${note.tc}-${index}`}><CardContent className="grid min-w-0 gap-2 p-3"><Badge variant="destructive" className="w-fit">{note.tc || '—'}</Badge><p className="wrap-text break-words text-xs leading-5">{note.text}</p></CardContent></Card>)}</div> : <p className="mt-3 wrap-text break-words text-sm leading-6 text-muted-foreground">No date notes were recorded for this clip.</p>}
            </section>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em]">Material timeline</p>
            <div className="relative mt-5 h-12 border-b-2 border-accent">{notes.slice(0, 8).map((_, index) => <i key={index} className="absolute bottom-[-0.375rem] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-muted" style={{ left: `${((index + 1) / (Math.min(notes.length, 8) + 1)) * 100}%` }} />)}</div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-muted-foreground"><span>00:00</span><span>End</span></div>
        </aside>
      </div>
    </>}

    {showReports && <ReportManager reports={reports} canEdit={canEditReports} onClose={() => setShowReports(false)} />}
    {showUsers && currentRole === 'admin' && session?.user && <UserManager currentUserId={session.user.id} onClose={() => setShowUsers(false)} />}
  </main>;
}

function Stat({ value, label, flagged = false, wide = false }: { value: number | string; label: string; flagged?: boolean; wide?: boolean }) {
  return <div className={`viewer-stat${flagged ? ' flagged' : ''}${wide ? ' span' : ''}`}><b>{value}</b><span>{label}</span></div>;
}

function ViewerToolbar({ query, setQuery, filter, setFilter, sort, setSort, archiveView, setArchiveView, count, total, onClear }: {
  query: string;
  setQuery: (value: string) => void;
  filter: FilterKey;
  setFilter: (value: FilterKey) => void;
  sort: SortKey;
  setSort: (value: SortKey) => void;
  archiveView: ArchiveView;
  setArchiveView: (value: ArchiveView) => void;
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
    <div className="segmented view-switch" role="group" aria-label="Archive view">
      <button data-testid="button-list-view" aria-pressed={archiveView === 'list'} onClick={() => setArchiveView('list')}>List</button>
      <button data-testid="button-calendar-view" aria-pressed={archiveView === 'calendar'} onClick={() => setArchiveView('calendar')}><CalendarDays /> Calendar</button>
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

function ClipList({ clips, query, selectedId, onSelect, hasClips, collapsedMonths, setCollapsedMonths }: { clips: Clip[]; query: string; selectedId: string | null; onSelect: (id: string) => void; hasClips: boolean; collapsedMonths: Record<string, boolean>; setCollapsedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  if (!clips.length) return <p className="empty-list">{hasClips ? <>No clips match.<br />Clear the search or choose a different filter.</> : <>No archive data loaded.<br />Add a CSV to start.</>}</p>;
  let lastGroup = '';
  return <div>{clips.map((clip) => {
    const parsed = dateValue(clip.date);
    const group = parsed ? monthLabel(parsed) : 'No date in clip ID';
    const groupKey = parsed ? monthKey(parsed) : 'no-date';
    const showGroup = group !== lastGroup;
    lastGroup = group;
    const collapsed = Boolean(collapsedMonths[groupKey]);
    const people = [...clip.hosts, ...clip.guests].join(', ');
    const sub = people || (clip.originalAir ? `Aired ${formatDate(clip.originalAir)}` : 'No people listed');
    return <div key={clip.id}>
      {showGroup && <button className="clip-group" aria-expanded={!collapsed} onClick={() => setCollapsedMonths((current) => ({ ...current, [groupKey]: !current[groupKey] }))}><span>{group}</span><ChevronRight className={collapsed ? '' : 'expanded'} /></button>}
      {!collapsed && <button data-clip-id={clip.id} className={`clip-item${clip.flagCount ? '' : ' is-clear'}${selectedId === clip.id ? ' selected' : ''}`} aria-current={selectedId === clip.id} onClick={() => onSelect(clip.id)}>
        <div><span className="clip-id">{highlight(clip.id, query)}</span>{clip.revision && <span className="revision">{clip.revision}</span>}</div>
        <div className="clip-sub">{highlight(sub, query)}</div>
        {clip.originalAir && <div className="clip-airdate">Original airdate · {formatDate(clip.originalAir)}</div>}
        <div className="clip-pips">
          {clip.sensitiveNotes.length > 0 && <span className="pip amber"><i />{clip.sensitiveNotes.length} date-sensitive</span>}
          {clip.dateNotes.length > 0 && <span className="pip cyan"><i />{clip.dateNotes.length} dates</span>}
          {clip.flagCount === 0 && <span className="pip clear"><i />no flags</span>}
        </div>
      </button>
      }
    </div>;
  })}</div>;
}

function CalendarView({ clips, month, setMonth, selectedId, onSelect }: { clips: Clip[]; month: string; setMonth: (value: string) => void; selectedId: string | null; onSelect: (id: string) => void }) {
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const currentMonth = month ? new Date(`${month}-01T12:00:00`) : new Date();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 12);
  const daysInCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const leadingDays = firstDay.getDay();
  const clipsByDate = useMemo(() => {
    const grouped = new Map<string, Clip[]>();
    clips.forEach((clip) => {
      const parsed = dateValue(clip.date);
      if (!parsed) return;
      const key = dateKey(parsed);
      grouped.set(key, [...(grouped.get(key) ?? []), clip]);
    });
    return grouped;
  }, [clips]);
  const selectedClip = clips.find((clip) => clip.id === selectedId);
  const activeDate = focusDate ?? (selectedClip?.date || null);
  const activeClips = activeDate ? clipsByDate.get(activeDate) ?? [] : [];
  const shiftMonth = (amount: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1, 12);
    setMonth(monthKey(next));
    setFocusDate(null);
  };
  const selectDay = (key: string) => {
    setFocusDate(key);
    const first = clipsByDate.get(key)?.[0];
    if (first) onSelect(first.id);
  };

  if (!clips.length) return <p className="empty-list">No clips match.<br />Clear the search or choose a different filter.</p>;

  return <div className="calendar-view">
    <div className="calendar-header">
      <button className="icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft /></button>
      <h2>{monthLabel(currentMonth)}</h2>
      <button className="icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight /></button>
    </div>
    <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: leadingDays + daysInCurrentMonth }, (_, index) => {
        if (index < leadingDays) return <span className="calendar-blank" key={`blank-${index}`} />;
        const day = index - leadingDays + 1;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12);
        const key = dateKey(date);
        const dayClips = clipsByDate.get(key) ?? [];
        const isSelected = activeDate === key;
        return <button key={key} className={`calendar-day${dayClips.length ? ' has-clips' : ''}${isSelected ? ' selected' : ''}`} aria-label={`${monthLabel(currentMonth)} ${day}${dayClips.length ? `, ${dayClips.length} clip${dayClips.length === 1 ? '' : 's'}` : ''}`} aria-pressed={isSelected} onClick={() => selectDay(key)}>
          <span>{day}</span>
          {dayClips.length > 0 && <b>{dayClips.length}</b>}
        </button>;
      })}
    </div>
    <div className="calendar-day-heading">{activeDate ? formatDate(activeDate) : 'Select a day with clips'}</div>
    {activeClips.length ? <div className="calendar-day-clips">{activeClips.map((clip) => <button key={clip.id} data-clip-id={clip.id} className={`calendar-clip${selectedId === clip.id ? ' selected' : ''}`} onClick={() => onSelect(clip.id)}><strong>{clip.id}</strong><span>{clip.sensitiveNotes.length} review · {clip.dateNotes.length} dates</span></button>)}</div> : <p className="calendar-empty">No clips on this day.</p>}
    {clips.some((clip) => !dateValue(clip.date)) && <p className="calendar-undated">{clips.filter((clip) => !dateValue(clip.date)).length} undated clip{clips.filter((clip) => !dateValue(clip.date)).length === 1 ? '' : 's'} hidden from calendar</p>}
  </div>;
}

function Placeholder({ hasClips }: { hasClips: boolean }) {
  return <div className="placeholder">
    <div className="placeholder-big">{hasClips ? 'Select a clip' : 'Load archive data'}</div>
    <p>{hasClips ? 'Pick a clip on the left to see its flags, people, and synopsis.' : 'Use Add data to load a CSV into the searchable archive.'}</p>
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
    </dl>

    <section className="detail-section">
      <h2>Synopsis</h2>
      <div className="synopsis">
        <div><h3>Short</h3><p>{clip.shortSynopsis ? highlight(clip.shortSynopsis, query) : <span className="none">Not provided.</span>}</p></div>
        <div className="synopsis-full"><h3>Full</h3><p>{clip.longSynopsis ? highlight(clip.longSynopsis, query) : <span className="none">{clip.duplicateLongSynopsis ? 'The full synopsis repeats the short synopsis.' : 'Not provided.'}</span>}</p></div>
      </div>
    </section>

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

function ReportManager({ reports, canEdit, onClose }: { reports: Report[]; canEdit: boolean; onClose: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const localQueryClient = useQueryClient();
  const remove = useDeleteReport();
  const upload = useUploadReport();
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
  };

  const submit = () => {
    if (!file) {
      setError('Choose a CSV file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ data: { name: file.name.replace(/\.csv$/i, ''), content: String(reader.result ?? '') } }, {
      onSuccess: () => {
        void localQueryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        void localQueryClient.invalidateQueries({ queryKey: getListClipsQueryKey() });
        setUploadOpen(false);
        setFile(null);
      },
      onError: () => setError('Upload failed. Check the CSV and try again.'),
    });
    reader.onerror = () => setError('The browser could not read that file.');
    reader.readAsText(file);
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reports-dialog-title">
    <div className="reports-modal">
      <div className="modal-header"><div><p className="eyebrow">Archive / data</p><h2 id="reports-dialog-title">Data imports</h2></div><button className="icon-button" aria-label="Close data imports" onClick={onClose}><X /></button></div>
      {canEdit && uploadOpen ? <div className="upload-panel">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={chooseFile} hidden />
        <button className="file-picker" onClick={() => fileRef.current?.click()}><Upload />{file?.name || 'Choose a CSV file'}</button>
        {error && <div className="inline-error"><AlertCircle />{error}</div>}
        <div className="modal-actions"><button className="btn ghost" onClick={() => setUploadOpen(false)}>Cancel</button><button className="btn primary" onClick={submit} disabled={upload.isPending}>{upload.isPending ? <LoaderCircle className="spin" /> : <Check />} Add to archive</button></div>
      </div> : <>
        {canEdit ? <div className="modal-actions top-actions"><button className="btn primary" onClick={() => { setUploadOpen(true); setError(''); }}><Upload /> Add data</button></div>
          : <div className="permission-note">Viewer access is read-only. An Editor or Administrator can add and delete imported data.</div>}
        {reports.length ? <div className="report-rows">{reports.map((report) => <div className="report-row" key={report.id}><div><strong>Imported data</strong><span>{report.clipCount} clips · added {formatDate(report.uploadedAt)}</span></div>{canEdit && <button className="icon-button danger" aria-label="Delete imported data" onClick={() => { if (window.confirm('Delete this imported data and its clips?')) remove.mutate({ reportId: report.id }, { onSuccess: () => { void localQueryClient.invalidateQueries({ queryKey: getListReportsQueryKey() }); void localQueryClient.invalidateQueries({ queryKey: getListClipsQueryKey() }); } }); }}><Trash2 /></button>}</div>)}</div> : <div className="modal-empty">{canEdit ? 'No imported data yet. Add a CSV to start.' : 'No imported data is available.'}</div>}
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
  const updateRole = useUpdateUserRole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    create.mutate({ data: { email: normalizedEmail, password, role } }, {
      onSuccess: () => {
        setEmail('');
        setPassword('');
        setRole('viewer');
        void localQueryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (nextError) => setError(mutationErrorMessage(nextError, 'The user could not be created.')),
    });
  };

  const changeRole = (user: User, nextRole: UserRole) => {
    if (nextRole === user.role) return;
    setError('');
    updateRole.mutate({ userId: user.id, data: { role: nextRole } }, {
      onSuccess: () => void localQueryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
      onError: (nextError) => setError(mutationErrorMessage(nextError, 'The role could not be updated.')),
    });
  };

  const deleteAccount = (user: User) => {
    if (!window.confirm(`Delete ${user.email}? Their imported data and sessions will also be removed.`)) return;
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
        <label>Role<select data-testid="select-new-user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Administrator</option></select><small>{roleDescriptions[role]}</small></label>
        {error && <div className="inline-error" data-testid="status-user-error"><AlertCircle />{error}</div>}
        <div className="modal-actions"><button data-testid="button-create-user" className="btn primary" type="submit" disabled={create.isPending}>{create.isPending ? <LoaderCircle className="spin" /> : <UserPlus />}{create.isPending ? 'Creating…' : 'Create user'}</button></div>
      </form>
      <div className="user-list-heading"><span>Existing accounts</span><b>{users.length}</b></div>
      {isLoading ? <div className="modal-empty"><LoaderCircle className="spin" /> Loading users…</div>
        : isError ? <div className="modal-empty"><p>Could not load users.</p><button className="btn" onClick={() => void refetch()}>Retry</button></div>
          : <div className="report-rows user-rows">{users.map((user) => <div className="report-row user-row" data-testid={`user-row-${user.id}`} key={user.id}>
            <div className="user-identity"><strong>{user.email}<span className={`role-badge ${user.role}`}>{roleLabels[user.role]}</span></strong><span>Created {formatDate(user.createdAt)} · {roleDescriptions[user.role]}</span></div>
            <div className="user-row-actions">
              <select data-testid={`select-user-role-${user.id}`} aria-label={`Role for ${user.email}`} value={user.role} disabled={user.id === currentUserId || updateRole.isPending} onChange={(event) => changeRole(user, event.target.value as UserRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Administrator</option></select>
              {user.id === currentUserId ? <span className="current-user-label">Current account</span> : user.role !== 'admin' && <button className="icon-button danger" aria-label={`Delete ${user.email}`} disabled={remove.isPending} onClick={() => deleteAccount(user)}><Trash2 /></button>}
            </div>
          </div>)}</div>}
    </div>
  </div>;
}

export default App;