import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileBarChart2,
  FileUp,
  Filter,
  Flag,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelRightOpen,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey,
  getGetDashboardSummaryQueryKey,
  getListClipsQueryKey,
  getListReportsQueryKey,
  useDeleteReport,
  useGetCurrentUser,
  useGetDashboardSummary,
  useListClips,
  useListReports,
  useLogin,
  useLogout,
  useRegister,
  useUploadReport,
  type Clip,
  type Report,
} from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

type AuthMode = 'login' | 'register';
type SortKey = 'date' | 'source' | 'flags';

const formatDate = (date: string | null | undefined, withTime = false) => {
  if (!date) return '—';
  const calendarMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = calendarMatch
    ? new Date(Number(calendarMatch[1]), Number(calendarMatch[2]) - 1, Number(calendarMatch[3]))
    : new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(parsed);
};

const formatDateRange = (from: string | null | undefined, to: string | null | undefined) => {
  if (!from && !to) return 'No dates in current workspace';
  if (from && to && from === to) return formatDate(from);
  return `${formatDate(from)} — ${formatDate(to)}`;
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message.replace(/^Error:\s*/i, '');
  return fallback;
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-reair">
      <div className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Radio className="size-[18px]" strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent ring-2 ring-sidebar" />
      </div>
      {!compact && (
        <div>
          <div className="font-extrabold tracking-[-0.04em] text-sidebar-foreground">re-air</div>
          <div className="mono text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/50">report desk</div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <SessionRouter />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function SessionRouter() {
  const [location] = useLocation();
  const { data: session, isLoading, isError } = useGetCurrentUser();

  if (isLoading) return <FullPageLoading label="Checking your desk session" />;

  const authRoute = location === '/login' || location === '/register';
  if (isError || !session?.authenticated) {
    return <AuthPage mode={location === '/register' ? 'register' : 'login'} />;
  }

  if (authRoute) {
    return <RedirectToWorkspace />;
  }

  return (
    <Switch>
      <Route path="/" component={Workspace} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RedirectToWorkspace() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/'), [setLocation]);
  return <FullPageLoading label="Opening your report desk" />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function FullPageLoading({ label }: { label: string }) {
  return (
    <main className="instrument-grid flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-10 py-9 text-center shadow-lg">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <LoaderCircle className="size-6 animate-spin" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">Your reports stay on this desk.</p>
        </div>
      </div>
    </main>
  );
}

function AuthPage({ mode: initialMode }: { mode: AuthMode }) {
  const [, setLocation] = useLocation();
  const queryClientLocal = useQueryClient();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const login = useLogin();
  const register = useRegister();

  useEffect(() => {
    setMode(initialMode);
    setFormError('');
    setIsComplete(false);
  }, [initialMode]);

  const pending = login.isPending || register.isPending;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!email.trim() || password.length < 8) {
      setFormError('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    if (mode === 'register' && password !== confirmation) {
      setFormError('Passwords do not match.');
      return;
    }
    const mutation = mode === 'login' ? login : register;
    mutation.mutate(
      { data: { email: email.trim(), password } },
      {
        onSuccess: (session) => {
          queryClientLocal.setQueryData(getGetCurrentUserQueryKey(), { authenticated: true, user: session.user });
          setIsComplete(true);
          setTimeout(() => setLocation('/'), 250);
        },
        onError: (error) => setFormError(errorMessage(error, 'Unable to complete that request.')),
      },
    );
  };

  return (
    <main className="min-h-[100dvh] bg-[#e6eaf0] text-foreground">
      <section className="instrument-grid flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[430px] fade-up">
            <div className="mb-10"><Logo /></div>
            <div className="mb-9">
              <p className="mono mb-3 text-[10px] uppercase tracking-[0.22em] text-accent">Your operations desk</p>
              <h2 className="text-3xl font-extrabold tracking-[-0.05em] text-foreground">
                {mode === 'login' ? 'Sign in to Re-Air.' : 'Create your desk.'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {mode === 'login' ? 'Pick up exactly where your review left off.' : 'Keep your reports close, controlled, and ready for review.'}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-foreground/70">Email address</span>
                <input data-testid="input-auth-email" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@station.org" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-foreground/70">Password</span>
                <input data-testid="input-auth-password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-foreground/70">Confirm password</span>
                  <input data-testid="input-auth-confirm-password" autoComplete="new-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Repeat your password" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                </label>
              )}
              {formError && <div data-testid="status-auth-error" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}
              {isComplete && <div data-testid="status-auth-success" className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3.5 py-3 text-sm text-accent"><Check className="size-4" /> Session ready. Opening your desk.</div>}
              <button data-testid="button-auth-submit" type="submit" disabled={pending || isComplete} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sidebar font-bold text-sidebar-foreground shadow-md transition hover:-translate-y-0.5 hover:bg-sidebar/90 focus:outline-none focus:ring-4 focus:ring-primary/25 disabled:cursor-wait disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : mode === 'login' ? <LogOut className="size-4 rotate-180" /> : <Plus className="size-4" />}
                {pending ? 'Checking credentials…' : mode === 'login' ? 'Enter report desk' : 'Create account'}
              </button>
            </form>
            <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
              {mode === 'login' ? 'New to this desk?' : 'Already have an account?'}{' '}
              <Link data-testid="link-auth-toggle" href={mode === 'login' ? '/register' : '/login'} className="font-bold text-accent underline-offset-4 hover:underline">
                {mode === 'login' ? 'Create an account' : 'Sign in instead'}
              </Link>
            </div>
            <p className="mt-12 text-center text-[11px] text-muted-foreground/70">Re-Air keeps your broadcast review data on your own infrastructure.</p>
          </div>
      </section>
    </main>
  );
}

function Workspace() {
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'reports'>('overview');
  const queryClientLocal = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: reports, isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useListReports();
  const { data: clips, isLoading: clipsLoading, isError: clipsError, refetch: refetchClips } = useListClips();
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useGetDashboardSummary();
  const logout = useLogout();

  const refreshAll = () => {
    void refetchReports();
    void refetchClips();
    void refetchSummary();
  };
  const signOut = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClientLocal.setQueryData(getGetCurrentUserQueryKey(), { authenticated: false, user: null });
      },
    });
  };

  const selectedClip = clips?.find((clip) => clip.id === selectedClipId) ?? null;

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <Sidebar activeView={activeView} setActiveView={setActiveView} mobileNav={mobileNav} setMobileNav={setMobileNav} userEmail={user?.user?.email ?? ''} onSignOut={signOut} />
      {mobileNav && <button aria-label="Close navigation" data-testid="button-close-mobile-nav" className="fixed inset-0 z-30 bg-sidebar/40 lg:hidden" onClick={() => setMobileNav(false)} />}
      <main className="min-w-0 flex-1 lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button data-testid="button-open-mobile-nav" aria-label="Open navigation" onClick={() => setMobileNav(true)} className="rounded-lg p-2 hover:bg-muted lg:hidden"><Menu className="size-5" /></button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="mono text-[10px] text-accent">OPS /</span><span>{activeView === 'overview' ? 'Overview' : 'Reports'}</span></div>
            <h1 className="text-base font-extrabold tracking-[-0.03em] sm:hidden">{activeView === 'overview' ? 'Overview' : 'Reports'}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent sm:flex"><span className="size-1.5 rounded-full bg-accent" /> Private workspace</span>
            <button data-testid="button-refresh-workspace" aria-label="Refresh workspace" onClick={refreshAll} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><RefreshCw className="size-[17px]" /></button>
            <div className="grid size-9 place-items-center rounded-full bg-sidebar text-xs font-bold text-sidebar-foreground">{user?.user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}</div>
          </div>
        </header>
        <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {activeView === 'overview' ? (
            <OverviewContent
              reports={reports ?? []}
              clips={clips ?? []}
              summary={summary}
              loading={reportsLoading || clipsLoading || summaryLoading}
              error={reportsError || clipsError || summaryError}
              onRetry={refreshAll}
              onOpenReports={() => setActiveView('reports')}
              onSelectClip={setSelectedClipId}
            />
          ) : (
            <ReportsContent reports={reports ?? []} clips={clips ?? []} loading={reportsLoading} error={reportsError} onRetry={refetchReports} />
          )}
        </div>
      </main>
      {selectedClip && <ClipPanel clip={selectedClip} onClose={() => setSelectedClipId(null)} />}
    </div>
  );
}

function Sidebar({
  activeView,
  setActiveView,
  mobileNav,
  setMobileNav,
  userEmail,
  onSignOut,
}: {
  activeView: 'overview' | 'reports';
  setActiveView: (view: 'overview' | 'reports') => void;
  mobileNav: boolean;
  setMobileNav: (value: boolean) => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl transition-transform duration-300 lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo /><button data-testid="button-close-sidebar" aria-label="Close navigation" className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden" onClick={() => setMobileNav(false)}><X className="size-4" /></button></div>
      <div className="mt-12 px-2"><p className="mono text-[9px] uppercase tracking-[0.25em] text-sidebar-foreground/40">Workspace</p></div>
      <nav aria-label="Main navigation" className="mt-3 space-y-1">
        <button data-testid="nav-overview" onClick={() => { setActiveView('overview'); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeView === 'overview' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><LayoutDashboard className="size-[17px]" /> Overview {activeView === 'overview' && <span className="ml-auto size-1.5 rounded-full bg-primary" />}</button>
        <button data-testid="nav-reports" onClick={() => { setActiveView('reports'); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeView === 'reports' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><FolderOpen className="size-[17px]" /> Reports {activeView === 'reports' && <span className="ml-auto size-1.5 rounded-full bg-primary" />}</button>
      </nav>
      <div className="mt-8 px-2"><p className="mono text-[9px] uppercase tracking-[0.25em] text-sidebar-foreground/40">Desk status</p></div>
      <div className="mt-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/.14)]" /> In sync</div>
        <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/50">Your workspace is private and ready for review.</p>
      </div>
      <div className="mt-auto border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid size-8 place-items-center rounded-lg bg-sidebar-accent text-[10px] font-bold">{userEmail.slice(0, 2).toUpperCase() || 'OP'}</div>
          <div className="min-w-0"><div className="truncate text-xs font-semibold">{userEmail || 'Operations user'}</div><div className="mono mt-0.5 text-[9px] text-sidebar-foreground/40">REVIEWER</div></div>
        </div>
        <button data-testid="button-sign-out" onClick={onSignOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-sidebar-foreground/55 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut className="size-4" /> Sign out</button>
      </div>
    </aside>
  );
}

function OverviewContent({
  reports,
  clips,
  summary,
  loading,
  error,
  onRetry,
  onOpenReports,
  onSelectClip,
}: {
  reports: Report[];
  clips: Clip[];
  summary?: { reportCount: number; clipCount: number; reviewCount: number; flagCount: number; earliestClipDate: string | null; latestClipDate: string | null };
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenReports: () => void;
  onSelectClip: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [showFilters, setShowFilters] = useState(false);
  const filteredClips = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    return clips
      .filter((clip) => {
        const searchable = [clip.id, clip.source, clip.shortSynopsis, ...(clip.hosts ?? []), ...(clip.guests ?? [])].join(' ').toLowerCase();
        const matchesSearch = !query || searchable.includes(query);
        const clipTime = clip.date ? new Date(clip.date).getTime() : 0;
        const matchesDate = dateFilter === 'all' || (dateFilter === 'flagged' && clip.flagCount > 0) || (dateFilter === 'recent' && clipTime > now - 1000 * 60 * 60 * 24 * 30);
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        if (sort === 'flags') return b.flagCount - a.flagCount;
        if (sort === 'source') return a.source.localeCompare(b.source);
        return (b.date ?? '').localeCompare(a.date ?? '');
      });
  }, [clips, dateFilter, search, sort]);

  const flagged = useMemo(() => clips.filter((clip) => clip.flagCount > 0).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5), [clips]);

  if (error) return <ErrorState onRetry={onRetry} />;

  return (
    <div className="space-y-8">
      <section className="fade-up flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div><p className="mono mb-3 text-[10px] uppercase tracking-[0.24em] text-accent">Broadcast review / live desk</p><h2 data-testid="text-page-title" className="text-3xl font-extrabold tracking-[-0.055em] sm:text-[40px]">Good morning, operator.</h2><p data-testid="text-workspace-date-range" className="mt-3 text-sm text-muted-foreground">Here’s the signal across your report archive.</p></div>
        <button data-testid="button-manage-reports" onClick={onOpenReports} className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold shadow-xs transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"><FolderOpen className="size-4" /> Manage reports <ChevronRight className="size-4 text-muted-foreground" /></button>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 fade-up-delay-1">
        <MetricCard label="Reports indexed" value={summary?.reportCount ?? reports.length} meta="Uploaded sources" icon={FileBarChart2} accent="amber" loading={loading} />
        <MetricCard label="Clips in archive" value={summary?.clipCount ?? clips.length} meta="Across all reports" icon={ClipboardList} accent="teal" loading={loading} />
        <MetricCard label="Review queue" value={summary?.reviewCount ?? filteredClips.length} meta="Clips with attention" icon={Clock3} accent="blue" loading={loading} />
        <MetricCard label="Flagged moments" value={summary?.flagCount ?? clips.reduce((total, clip) => total + clip.flagCount, 0)} meta="Needs a closer look" icon={ShieldAlert} accent="red" loading={loading} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] fade-up-delay-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-extrabold tracking-[-0.03em]">Clip review queue</h3><p className="mt-1 text-xs text-muted-foreground">Search the details that matter, then open the full record.</p></div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-56"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-clip-search" aria-label="Search clips" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clips…" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-accent focus:ring-3 focus:ring-accent/10" /></div>
              <button data-testid="button-toggle-filters" aria-label="Toggle clip filters" onClick={() => setShowFilters((value) => !value)} className={`grid size-9 place-items-center rounded-lg border transition ${showFilters ? 'border-accent bg-accent/10 text-accent' : 'border-input text-muted-foreground hover:bg-muted'}`}><Filter className="size-4" /></button>
            </div>
          </div>
          {showFilters && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/35 px-5 py-3">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Show</span>
            {(['all', 'flagged', 'recent'] as const).map((filter) => <button key={filter} data-testid={`button-filter-${filter}`} onClick={() => setDateFilter(filter)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${dateFilter === filter ? 'bg-sidebar text-sidebar-foreground' : 'text-muted-foreground hover:bg-card'}`}>{filter === 'all' ? 'All clips' : filter === 'flagged' ? 'Flagged only' : 'Last 30 days'}</button>)}
            <span className="ml-auto mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Sort</span>
            <select data-testid="select-clip-sort" aria-label="Sort clips" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-input bg-card px-2 py-1.5 text-xs font-semibold outline-none focus:border-accent"><option value="date">Newest date</option><option value="flags">Most flags</option><option value="source">Source A–Z</option></select>
          </div>}
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1.1fr_1.3fr_1fr_1.3fr_56px] gap-4 border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground"><span>Clip / source</span><span>Air date</span><span>People</span><span>Synopsis</span><span /></div>
              {loading ? <ClipTableSkeleton /> : filteredClips.length === 0 ? <EmptyClips hasSearch={Boolean(search || dateFilter !== 'all')} onReset={() => { setSearch(''); setDateFilter('all'); }} /> : filteredClips.slice(0, 12).map((clip) => <ClipRow key={clip.id} clip={clip} onSelect={() => onSelectClip(clip.id)} />)}
            </div>
          </div>
          {filteredClips.length > 12 && <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">Showing 12 of {filteredClips.length} clips · refine your search to narrow the queue</div>}
        </div>
        <aside className="rounded-2xl border border-border bg-sidebar p-5 text-sidebar-foreground shadow-sm">
          <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[0.18em] text-primary">Signal watch</p><h3 className="mt-2 font-extrabold tracking-[-0.03em]">Flag timeline</h3></div><div className="grid size-9 place-items-center rounded-xl bg-sidebar-accent"><Flag className="size-4 text-primary" /></div></div>
          <p className="mt-2 text-xs leading-5 text-sidebar-foreground/55">The latest moments marked for a second pass.</p>
          <div className="mt-6 space-y-0">
            {loading ? <TimelineSkeleton /> : flagged.length === 0 ? <div data-testid="empty-flag-timeline" className="rounded-xl border border-dashed border-sidebar-border p-5 text-center"><Check className="mx-auto size-5 text-accent" /><p className="mt-2 text-xs font-semibold">No flags in the archive</p><p className="mt-1 text-[11px] text-sidebar-foreground/45">A clean signal for now.</p></div> : flagged.map((clip, index) => <button data-testid={`button-flagged-clip-${clip.id}`} key={clip.id} onClick={() => onSelectClip(clip.id)} className="group relative flex w-full gap-3 pb-5 text-left last:pb-0"><div className="relative mt-1 flex w-3 justify-center"><span className={`z-10 size-2.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-sidebar-foreground/30'}`} />{index < flagged.length - 1 && <span className="absolute top-2 h-full w-px bg-sidebar-border" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="mono text-[10px] text-primary">{clip.date ? formatDate(clip.date) : 'Undated'}</span><span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-[#f28d82]">{clip.flagCount} {clip.flagCount === 1 ? 'flag' : 'flags'}</span></div><p className="mt-1 truncate text-xs font-semibold text-sidebar-foreground/85 group-hover:text-primary">{clip.shortSynopsis || clip.source || `Clip ${clip.id}`}</p><p className="mt-1 truncate text-[10px] text-sidebar-foreground/45">{clip.source} · {clip.time || 'time not set'}</p></div></button>)}
          </div>
        </aside>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] fade-up-delay-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Archive span</p><h3 className="mt-2 text-lg font-extrabold tracking-[-0.03em]">A wider view of the desk</h3></div><BarChart3 className="size-5 text-accent" /></div><div className="mt-7 flex items-end gap-3"><span data-testid="text-earliest-clip-date" className="text-2xl font-extrabold tracking-[-0.05em]">{formatDate(summary?.earliestClipDate)}</span><span className="mb-1 text-xs text-muted-foreground">through</span><span data-testid="text-latest-clip-date" className="text-2xl font-extrabold tracking-[-0.05em]">{formatDate(summary?.latestClipDate)}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-accent to-primary" /></div><p className="mt-3 text-xs text-muted-foreground">{formatDateRange(summary?.earliestClipDate, summary?.latestClipDate)}</p></div>
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6"><div className="absolute -right-12 -top-12 size-40 rounded-full border-[18px] border-primary-foreground/10" /><div className="absolute -bottom-20 -left-10 size-40 rounded-full border-[18px] border-primary-foreground/10" /><div className="relative"><div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15"><HardDrive className="size-4" /></div><h3 className="mt-5 text-lg font-extrabold tracking-[-0.03em]">Your reports, locally held.</h3><p className="mt-2 max-w-sm text-xs leading-5 text-primary-foreground/75">This desk talks to your own Re-Air server. No third-party upload, no hidden handoff.</p><button data-testid="button-open-report-management" onClick={onOpenReports} className="mt-5 flex items-center gap-2 rounded-lg bg-primary-foreground px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary-foreground/90">Open report management <ChevronRight className="size-3.5" /></button></div></div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, meta, icon: Icon, accent, loading }: { label: string; value: number; meta: string; icon: typeof BarChart3; accent: string; loading: boolean }) {
  const accentClass: Record<string, string> = { amber: 'bg-primary/12 text-primary', teal: 'bg-accent/12 text-accent', blue: 'bg-[#5e79bb]/12 text-[#4e67a2]', red: 'bg-destructive/12 text-destructive' };
  return <div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex items-start justify-between"><div className={`grid size-9 place-items-center rounded-xl ${accentClass[accent]}`}><Icon className="size-[17px]" /></div><MoreHorizontal className="size-4 text-muted-foreground/50" /></div>{loading ? <div className="mt-5 h-8 w-16 animate-pulse rounded-md bg-muted" /> : <div data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-5 text-3xl font-extrabold tracking-[-0.06em]">{value.toLocaleString()}</div>}<p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/65">{meta}</p></div>;
}

function ClipRow({ clip, onSelect }: { clip: Clip; onSelect: () => void }) {
  return <button data-testid={`row-clip-${clip.id}`} onClick={onSelect} className="grid w-full grid-cols-[1.1fr_1.3fr_1fr_1.3fr_56px] items-center gap-4 border-b border-border px-5 py-4 text-left transition last:border-0 hover:bg-muted/55 focus:bg-muted/55 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent">
    <div className="min-w-0"><div className="flex items-center gap-2"><span className="mono truncate text-xs font-medium text-foreground">{clip.id}</span>{clip.flagCount > 0 && <span className="size-1.5 shrink-0 rounded-full bg-destructive" />}</div><p className="mt-1 truncate text-[11px] text-muted-foreground">{clip.source || 'Unknown source'}</p></div>
    <div className="min-w-0"><p className="text-xs font-semibold">{formatDate(clip.date)}</p><p className="mono mt-1 text-[10px] text-muted-foreground">{clip.time || '—'} {clip.revision ? `· rev ${clip.revision}` : ''}</p></div>
    <div className="min-w-0"><p className="truncate text-xs">{[...(clip.hosts ?? []), ...(clip.guests ?? [])].slice(0, 2).join(', ') || 'No names listed'}</p><p className="mt-1 text-[10px] text-muted-foreground">{(clip.hosts?.length ?? 0) + (clip.guests?.length ?? 0)} people</p></div>
    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{clip.shortSynopsis || clip.longSynopsis || 'No synopsis available.'}</p>
    <div className="flex justify-end">{clip.flagCount > 0 ? <span className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive"><Flag className="size-3" />{clip.flagCount}</span> : <ChevronRight className="size-4 text-muted-foreground/50" />}</div>
  </button>;
}

function ClipTableSkeleton() {
  return <div className="divide-y divide-border">{[1, 2, 3, 4, 5].map((row) => <div key={row} className="grid grid-cols-[1.1fr_1.3fr_1fr_1.3fr_56px] gap-4 px-5 py-5">{[1, 2, 3, 4].map((cell) => <div key={cell} className="h-4 animate-pulse rounded bg-muted" />)}</div>)}</div>;
}
function TimelineSkeleton() { return <div className="space-y-5">{[1, 2, 3].map((item) => <div key={item} className="flex gap-3"><div className="size-3 animate-pulse rounded-full bg-sidebar-accent" /><div className="flex-1 space-y-2"><div className="h-3 w-20 animate-pulse rounded bg-sidebar-accent" /><div className="h-3 w-full animate-pulse rounded bg-sidebar-accent" /></div></div>)}</div>; }
function EmptyClips({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void }) {
  return <div data-testid="empty-clips" className="px-6 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Search className="size-5" /></div><h4 className="mt-4 text-sm font-bold">{hasSearch ? 'No clips match that view' : 'No clips indexed yet'}</h4><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{hasSearch ? 'Try a different source, person, or filter.' : 'Upload a CSV report to put the first signal on your desk.'}</p>{hasSearch && <button data-testid="button-reset-clip-filters" onClick={onReset} className="mt-4 text-xs font-bold text-accent hover:underline">Reset filters</button>}</div>;
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div data-testid="status-workspace-error" className="mx-auto flex max-w-lg flex-col items-center justify-center py-24 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertCircle className="size-6" /></div><h2 className="mt-5 text-xl font-extrabold tracking-[-0.03em]">The desk missed a beat.</h2><p className="mt-2 text-sm text-muted-foreground">We couldn’t load the current report data. Your server may need a moment.</p><button data-testid="button-retry-workspace" onClick={onRetry} className="mt-6 flex items-center gap-2 rounded-lg bg-sidebar px-4 py-2.5 text-xs font-bold text-sidebar-foreground transition hover:bg-sidebar/90"><RefreshCw className="size-4" /> Try again</button></div>;
}

function ReportsContent({ reports, clips, loading, error, onRetry }: { reports: Report[]; clips: Clip[]; loading: boolean; error: boolean; onRetry: () => void }) {
  const queryClientLocal = useQueryClient();
  const upload = useUploadReport();
  const remove = useDeleteReport();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const clipCountFor = (id: number) => clips.filter((clip) => clip.reportId === id).length;
  const submitUpload = () => {
    if (!selectedFile || !reportName.trim()) {
      setUploadError('Choose a CSV file and give this report a name.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      upload.mutate({ data: { name: reportName.trim(), content: String(reader.result ?? '') } }, {
        onSuccess: () => {
          setShowUpload(false);
          setSelectedFile(null);
          setReportName('');
          setUploadError('');
          setNotice('Report uploaded and indexed.');
          void queryClientLocal.invalidateQueries({ queryKey: getListReportsQueryKey() });
          void queryClientLocal.invalidateQueries({ queryKey: getListClipsQueryKey() });
          void queryClientLocal.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (error) => setUploadError(errorMessage(error, 'Upload failed. Check the CSV and try again.')),
      });
    };
    reader.onerror = () => setUploadError('The browser could not read that file.');
    reader.readAsText(selectedFile);
  };
  const confirmDelete = (id: number) => {
    remove.mutate({ reportId: id }, {
      onSuccess: () => {
        setDeleteId(null);
        setNotice('Report removed from this desk.');
        void queryClientLocal.invalidateQueries({ queryKey: getListReportsQueryKey() });
        void queryClientLocal.invalidateQueries({ queryKey: getListClipsQueryKey() });
        void queryClientLocal.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (error) => setNotice(errorMessage(error, 'Could not delete that report.')),
    });
  };
  if (error) return <ErrorState onRetry={onRetry} />;
  return <div className="space-y-7">
    <section className="fade-up flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[0.24em] text-accent">Archive / sources</p><h2 className="text-3xl font-extrabold tracking-[-0.055em] sm:text-[40px]">Report management.</h2><p className="mt-3 text-sm text-muted-foreground">Upload, inspect, and clear the files that power your review queue.</p></div><button data-testid="button-upload-report" onClick={() => { setShowUpload(true); setUploadError(''); }} className="flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:brightness-105"><UploadCloud className="size-4" /> Upload CSV</button></section>
    {notice && <div data-testid="status-report-notice" className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent"><span className="flex items-center gap-2"><Check className="size-4" />{notice}</span><button data-testid="button-dismiss-report-notice" onClick={() => setNotice('')}><X className="size-4" /></button></div>}
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-5"><div><h3 className="font-extrabold tracking-[-0.03em]">Uploaded reports</h3><p className="mt-1 text-xs text-muted-foreground">{reports.length} {reports.length === 1 ? 'source' : 'sources'} connected to this desk.</p></div><span className="mono rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">CSV / UTF-8</span></div>
      {loading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div> : reports.length === 0 ? <div data-testid="empty-reports" className="px-6 py-20 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><FileUp className="size-6" /></div><h4 className="mt-5 font-bold">Your archive is waiting.</h4><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with a re-air CSV export. It will be parsed and made searchable here.</p><button data-testid="button-empty-upload-report" onClick={() => setShowUpload(true)} className="mt-5 rounded-lg bg-sidebar px-4 py-2.5 text-xs font-bold text-sidebar-foreground hover:bg-sidebar/90">Upload first report</button></div> : <div className="divide-y divide-border">{reports.map((report) => <div data-testid={`row-report-${report.id}`} key={report.id} className="flex flex-col gap-4 px-5 py-5 transition hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-accent"><FileBarChart2 className="size-5" /></div><div className="min-w-0"><h4 className="truncate text-sm font-bold">{report.name}</h4><p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{report.clipCount || clipCountFor(report.id)}</span> clips <span className="mx-1.5 text-border">·</span> uploaded {formatDate(report.uploadedAt, true)}</p></div></div><div className="flex items-center gap-2 pl-[60px] sm:pl-0"><span className="mr-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent"><span className="size-1.5 rounded-full bg-accent" /> Indexed</span><button data-testid={`button-delete-report-${report.id}`} aria-label={`Delete ${report.name}`} onClick={() => setDeleteId(report.id)} className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button></div></div>)}</div>}
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent"><CircleHelp className="size-4" /></div><div><h3 className="text-sm font-bold">A note on report names</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Use names that make sense in a handoff: a date range, show code, or export batch. The original CSV remains on your server; Re-Air stores the parsed report for fast review.</p></div></div></section>
    {showUpload && <UploadDialog name={reportName} setName={setReportName} file={selectedFile} setFile={setSelectedFile} error={uploadError} pending={upload.isPending} onCancel={() => { setShowUpload(false); setSelectedFile(null); setReportName(''); setUploadError(''); }} onSubmit={submitUpload} />}
    {deleteId !== null && <ConfirmDeleteDialog report={reports.find((report) => report.id === deleteId)} pending={remove.isPending} onCancel={() => setDeleteId(null)} onConfirm={() => confirmDelete(deleteId)} />}
  </div>;
}

function UploadDialog({ name, setName, file, setFile, error, pending, onCancel, onSubmit }: { name: string; setName: (value: string) => void; file: File | null; setFile: (file: File | null) => void; error: string; pending: boolean; onCancel: () => void; onSubmit: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    if (next && !next.name.toLowerCase().endsWith('.csv')) {
      setFile(null);
      return;
    }
    setFile(next);
    if (next && !name) setName(next.name.replace(/\.csv$/i, ''));
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 px-5 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title"><div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl fade-up"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[0.18em] text-accent">New source</p><h2 id="upload-dialog-title" className="mt-2 text-xl font-extrabold tracking-[-0.04em]">Upload a report</h2><p className="mt-2 text-xs text-muted-foreground">Bring a CSV export into the searchable archive.</p></div><button data-testid="button-close-upload-dialog" aria-label="Close upload dialog" onClick={onCancel} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button></div><div className="mt-7 space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em]">Report name</span><input data-testid="input-report-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning news / 2024-06" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><div><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em]">CSV file</span><input ref={fileRef} data-testid="input-report-file" type="file" accept=".csv,text/csv" onChange={chooseFile} className="sr-only" /><button data-testid="button-choose-report-file" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border border-dashed border-input bg-muted/35 px-4 py-5 text-left transition hover:border-accent hover:bg-accent/5 focus:outline-none focus:ring-3 focus:ring-accent/15">{file ? <div className="grid size-10 place-items-center rounded-lg bg-accent/10 text-accent"><Check className="size-5" /></div> : <div className="grid size-10 place-items-center rounded-lg bg-card text-muted-foreground shadow-xs"><FileUp className="size-5" /></div>}<div className="min-w-0"><p className="truncate text-sm font-bold">{file?.name || 'Choose a CSV file'}</p><p className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB ready to read` : 'CSV exports up to your server’s limit'}</p></div><ChevronDown className="ml-auto size-4 -rotate-90 text-muted-foreground" /></button></div>{error && <div data-testid="status-upload-error" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{error}</div>}</div><div className="mt-7 flex justify-end gap-2"><button data-testid="button-cancel-upload" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted">Cancel</button><button data-testid="button-submit-upload" disabled={pending} onClick={onSubmit} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">{pending && <LoaderCircle className="size-3.5 animate-spin" />} {pending ? 'Indexing report…' : 'Upload and index'}</button></div></div></div>;
}

function ConfirmDeleteDialog({ report, pending, onCancel, onConfirm }: { report?: Report; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl fade-up"><div className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive"><Trash2 className="size-5" /></div><h2 id="delete-dialog-title" className="mt-5 text-lg font-extrabold tracking-[-0.03em]">Remove this report?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground"><span className="font-semibold text-foreground">{report?.name ?? 'This report'}</span> and its indexed clips will be removed from your desk. This cannot be undone.</p><div className="mt-7 flex justify-end gap-2"><button data-testid="button-cancel-delete-report" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted">Keep report</button><button data-testid="button-confirm-delete-report" disabled={pending} onClick={onConfirm} className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-xs font-bold text-destructive-foreground disabled:opacity-60">{pending && <LoaderCircle className="size-3.5 animate-spin" />} Remove</button></div></div></div>;
}

function ClipPanel({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-sidebar/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="clip-panel-title"><button data-testid="button-close-clip-panel-overlay" aria-label="Close clip details" onClick={onClose} className="absolute inset-0 cursor-default" /><aside className="relative z-10 flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l border-border bg-card shadow-2xl fade-up"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-md"><div className="flex items-center gap-2 text-xs font-bold text-accent"><PanelRightOpen className="size-4" /> Clip details</div><button data-testid="button-close-clip-panel" aria-label="Close clip details" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button></div><div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Record / {clip.reportId}</p><h2 id="clip-panel-title" data-testid={`text-clip-title-${clip.id}`} className="mt-2 break-all text-2xl font-extrabold tracking-[-0.05em]">{clip.id}</h2><p className="mt-2 text-sm font-semibold text-accent">{clip.source || 'Unknown source'}</p></div>{clip.flagCount > 0 && <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs font-bold text-destructive"><Flag className="size-3.5" /> {clip.flagCount} flagged</span>}</div><div className="mt-7 grid grid-cols-2 gap-2"><DetailCell label="Air date" value={formatDate(clip.date)} icon={CalendarDays} /><DetailCell label="Timecode" value={clip.time || 'Not set'} icon={Clock3} /><DetailCell label="Original air" value={formatDate(clip.originalAir)} icon={Radio} /><DetailCell label="Last air" value={formatDate(clip.lastAir)} icon={RefreshCw} /></div><DetailBlock label="Synopsis"><p data-testid={`text-clip-synopsis-${clip.id}`} className="text-sm leading-6 text-foreground/80">{clip.longSynopsis || clip.shortSynopsis || 'No synopsis available.'}</p>{clip.shortSynopsis && clip.longSynopsis && clip.shortSynopsis !== clip.longSynopsis && <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">{clip.shortSynopsis}</p>}</DetailBlock><div className="grid gap-5 sm:grid-cols-2"><PeopleBlock title="Hosts" people={clip.hosts} /><PeopleBlock title="Guests" people={clip.guests} /></div>{clip.duplicateLongSynopsis && <div className="mt-5 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/10 p-3 text-xs leading-5 text-foreground/75"><Archive className="mt-0.5 size-4 shrink-0 text-primary" /><span><strong className="text-foreground">Duplicate synopsis detected.</strong> This record shares a long synopsis with another clip in the archive.</span></div>}<NotesBlock title="Sensitive notes" notes={clip.sensitiveNotes} tone="red" /><NotesBlock title="Date notes" notes={clip.dateNotes} tone="teal" /></div></aside></div>;
}

function DetailCell({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) {
  return <div className="rounded-xl border border-border bg-muted/35 p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><Icon className="size-3" />{label}</div><p className="mono mt-2 truncate text-xs font-medium text-foreground">{value}</p></div>;
}
function DetailBlock({ label, children }: { label: string; children: ReactNode }) { return <section className="mt-7"><h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</h3>{children}</section>; }
function PeopleBlock({ title, people }: { title: string; people: string[] }) { return <section className="mt-7"><h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{title}</h3>{people?.length ? <div className="flex flex-wrap gap-2">{people.map((person) => <span data-testid={`chip-${title.toLowerCase()}-${person}`} key={person} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">{person}</span>)}</div> : <p className="text-xs text-muted-foreground">None listed</p>}</section>; }
function NotesBlock({ title, notes, tone }: { title: string; notes: { tc: string; secs: number | null; text: string }[]; tone: 'red' | 'teal' }) {
  if (!notes?.length) return null;
  return <DetailBlock label={`${title} · ${notes.length}`}><div className="space-y-2">{notes.map((note, index) => <div data-testid={`note-${title.toLowerCase().replaceAll(' ', '-')}-${index}`} key={`${note.tc}-${index}`} className={`rounded-xl border p-3 ${tone === 'red' ? 'border-destructive/20 bg-destructive/5' : 'border-accent/20 bg-accent/5'}`}><div className="flex items-center justify-between gap-3"><span className={`mono text-[10px] font-medium ${tone === 'red' ? 'text-destructive' : 'text-accent'}`}>{note.tc || 'No timecode'}</span>{note.secs !== null && <span className="text-[10px] text-muted-foreground">{note.secs}s</span>}</div><p className="mt-1.5 text-xs leading-5 text-foreground/75">{note.text}</p></div>)}</div></DetailBlock>;
}

export default App;