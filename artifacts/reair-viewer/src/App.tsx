import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePlus2,
  Flag,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Printer,
  Radio,
  Search,
  StickyNote,
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
  getGetClipReviewQueryKey,
  getListClipsQueryKey,
  getListReportsQueryKey,
  useCreateUser,
  useChangeMyPassword,
  useDeleteClip,
  useDeleteReport,
  useDeleteUser,
  useGetCurrentUser,
  useGetClipReview,
  useListClips,
  useListReports,
  useListUsers,
  useLogin,
  useLogout,
  useUpdateUserRole,
  useUpdateClipReview,
  useUpdateClipReviewAnnotation,
  useUploadReport,
  type Clip,
  type ClipReview,
  type EpisodeDisposition,
  type Report,
  type ReviewAnnotation,
  type ReviewNoteKind,
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
import { Textarea } from '@workspace/reair-review-system/components/ui/textarea';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@workspace/reair-review-system/components/ui/context-menu';

const queryClient = new QueryClient();

type FilterKey = 'all' | 'review' | 'dates' | 'clear';
type SortKey = 'new' | 'old' | 'flags' | 'id';
type ArchiveView = 'list' | 'calendar';
type Disposition = Exclude<EpisodeDisposition, null>;
type DispositionFilter = 'all' | Disposition;
const dispositionOptions: Disposition[] = ['Needs edit', 'Hold for context', 'Clear for re-air'];

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

function formatTimelineTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
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

function reviewNoteKey(kind: ReviewNoteKind, note: { tc: string; secs: number | null; text: string }) {
  return `${kind}|${note.tc}|${note.secs ?? ''}|${note.text.trim().toLowerCase()}`;
}

function reviewStatusLabel(status: ReviewAnnotation['status']) {
  if (status === 'good-to-re-air') return 'Good to re-air';
  if (status === 'needs-edit') return 'Needs edit';
  return null;
}

function queueDispositionClass(disposition: string | undefined) {
  if (disposition === 'Needs edit') return 'disposition-needs-edit';
  if (disposition === 'Hold for context') return 'disposition-hold';
  if (disposition === 'Clear for re-air') return 'disposition-clear';
  return '';
}

function Logo() {
  return <div className="viewer-brand" data-testid="brand-reair">
    <img className="viewer-brand-icon" src={`${import.meta.env.BASE_URL}icons/icon-small.svg`} alt="" aria-hidden="true" />
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
        <h1>Sign in to Re-Air.</h1>
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileDetailTab, setMobileDetailTab] = useState<'overview' | 'dated'>('overview');
  const [query, setQuery] = useState('');
  const [decisions, setDecisions] = useState<Record<string, Disposition | undefined>>({});
  const [episodeDraft, setEpisodeDraft] = useState('');
  const [episodeDirty, setEpisodeDirty] = useState(false);
  const [reviewSaveError, setReviewSaveError] = useState('');
  const [clipDeleteError, setClipDeleteError] = useState('');
  const [editingAnnotation, setEditingAnnotation] = useState<{ kind: ReviewNoteKind; noteKey: string } | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [annotationError, setAnnotationError] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState<DispositionFilter>('all');
  const [sort, setSort] = useState<SortKey>('new');
  const [showReports, setShowReports] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const localQueryClient = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const { data: reports = [] } = useListReports();
  const { data: clips = [], isLoading: clipsLoading, isError: clipsError, refetch: refetchClips } = useListClips();
  const { data: clipReview, isLoading: reviewLoading, isError: reviewError } = useGetClipReview(selectedId ?? '', {
    query: {
      queryKey: getGetClipReviewQueryKey(selectedId ?? ''),
      enabled: Boolean(selectedId),
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  });
  const logout = useLogout();
  const removeClip = useDeleteClip();
  const saveEpisodeReview = useUpdateClipReview();
  const saveAnnotation = useUpdateClipReviewAnnotation();
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
    setMobileDetailOpen(false);
  }, [selectedId, view]);

  useEffect(() => {
    setEpisodeDraft('');
    setEpisodeDirty(false);
    setReviewSaveError('');
    setClipDeleteError('');
    setEditingAnnotation(null);
    setAnnotationDraft('');
    setAnnotationError('');
  }, [selectedId]);

  useEffect(() => {
    if (!episodeDirty) setEpisodeDraft(clipReview?.episodeNotes ?? '');
  }, [clipReview?.episodeNotes, episodeDirty]);

  useEffect(() => {
    const nextDecisions = Object.fromEntries(
      clips
        .filter((clip) => clip.disposition)
        .map((clip) => [clip.id, clip.disposition]),
    ) as Record<string, Disposition>;
    setDecisions((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextDecisions);
      if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === nextDecisions[key])) {
        return current;
      }
      return nextDecisions;
    });
  }, [clips]);

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

  const deleteSelectedClip = () => {
    if (!selected) return;
    const clipId = selected.id;
    if (!window.confirm(`Delete ${clipId} from the shared archive? This permanently removes the clip and its review notes.`)) return;

    const currentIndex = view.findIndex((clip) => clip.id === clipId);
    const nextSelection = view[currentIndex + 1]?.id ?? view[currentIndex - 1]?.id ?? null;
    setClipDeleteError('');
    removeClip.mutate({ clipId }, {
      onSuccess: () => {
        setSelectedId(nextSelection);
        setDecisions((current) => {
          const next = { ...current };
          delete next[clipId];
          return next;
        });
        localQueryClient.removeQueries({ queryKey: getGetClipReviewQueryKey(clipId) });
        localQueryClient.setQueryData<Clip[]>(getListClipsQueryKey(), (current) => current?.filter((clip) => clip.id !== clipId));
        void localQueryClient.invalidateQueries({ queryKey: getListClipsQueryKey() });
        void localQueryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
      onError: (error) => setClipDeleteError(mutationErrorMessage(error, 'This clip could not be deleted. Try again.')),
    });
  };

  const notes = selected ? [...selected.sensitiveNotes, ...selected.dateNotes] : [];
  const timedNotes = selected?.sensitiveNotes ?? [];
  const dateNotes = selected?.dateNotes ?? [];
  const timelineNotes = [
    ...timedNotes.map((note, index) => ({ ...note, kind: 'timed' as const, index })),
    ...dateNotes.map((note, index) => ({ ...note, kind: 'date' as const, index })),
  ]
    .filter((note) => note.secs !== null)
    .sort((left, right) => (left.secs ?? 0) - (right.secs ?? 0));
  const timelineMaxSeconds = Math.max(0, ...timelineNotes.map((note) => note.secs ?? 0));
  const timelineSpan = timelineNotes.length
    ? Math.max(60, Math.ceil((timelineMaxSeconds + 60) / 60) * 60)
    : 0;
  const timelinePosition = (seconds: number) => `${Math.min(98, Math.max(2, (seconds / timelineSpan) * 100))}%`;
  const people = selected ? [...selected.hosts, ...selected.guests] : [];
  const annotationById = useMemo(
    () => new Map((clipReview?.annotations ?? []).map((annotation) => [`${annotation.kind}|${annotation.noteKey}`, annotation])),
    [clipReview?.annotations],
  );

  const updateReviewCache = (clipId: string, review: ClipReview) => {
    localQueryClient.setQueryData(getGetClipReviewQueryKey(clipId), review);
  };

  const saveEpisodeNotes = () => {
    if (!selectedId) return;
    const clipId = selectedId;
    setReviewSaveError('');
    saveEpisodeReview.mutate({ clipId, data: { episodeNotes: episodeDraft, disposition: decisions[clipId] ?? clipReview?.disposition ?? null } }, {
      onSuccess: (review) => {
        updateReviewCache(clipId, review);
        localQueryClient.setQueryData<Clip[]>(getListClipsQueryKey(), (current) => current?.map((clip) => (
          clip.id === clipId ? { ...clip, disposition: review.disposition } : clip
        )));
        setEpisodeDraft(review.episodeNotes);
        setEpisodeDirty(false);
        setDecisions((current) => {
          const next = { ...current };
          if (review.disposition) next[clipId] = review.disposition;
          else delete next[clipId];
          return next;
        });
      },
      onError: () => setReviewSaveError('Episode notes could not be saved. Try again.'),
    });
  };

  const saveDisposition = (disposition: Disposition) => {
    if (!selectedId || reviewLoading) return;
    const clipId = selectedId;
    const previousDisposition = decisions[clipId];
    setReviewSaveError('');
    setDecisions((current) => ({ ...current, [clipId]: disposition }));
    saveEpisodeReview.mutate({ clipId, data: { episodeNotes: episodeDraft, disposition } }, {
      onSuccess: (review) => {
        updateReviewCache(clipId, review);
        localQueryClient.setQueryData<Clip[]>(getListClipsQueryKey(), (current) => current?.map((clip) => (
          clip.id === clipId ? { ...clip, disposition: review.disposition } : clip
        )));
        setEpisodeDraft(review.episodeNotes);
        setEpisodeDirty(false);
        setDecisions((current) => {
          const next = { ...current };
          if (review.disposition) next[clipId] = review.disposition;
          else delete next[clipId];
          return next;
        });
      },
      onError: () => {
        setReviewSaveError('Editorial disposition could not be saved. Try again.');
        setDecisions((current) => {
          const next = { ...current };
          if (previousDisposition) next[clipId] = previousDisposition;
          else delete next[clipId];
          return next;
        });
      },
    });
  };

  const saveFlagAnnotation = (
    kind: ReviewNoteKind,
    noteKey: string,
    note: string,
    status: ReviewAnnotation['status'],
  ) => {
    if (!selectedId) return;
    const clipId = selectedId;
    setAnnotationError('');
    saveAnnotation.mutate({
      clipId,
      data: { kind, noteKey, note, status },
    }, {
      onSuccess: (review) => {
        updateReviewCache(clipId, review);
        if (selectedId === clipId) {
          setEditingAnnotation(null);
          setAnnotationDraft('');
        }
      },
      onError: () => setAnnotationError('This flag annotation could not be saved. Try again.'),
    });
  };

  const beginAnnotationEdit = (kind: ReviewNoteKind, noteKey: string, annotation?: ReviewAnnotation) => {
    setEditingAnnotation({ kind, noteKey });
    setAnnotationDraft(annotation?.note ?? '');
    setAnnotationError('');
  };

  const cancelAnnotationEdit = () => {
    setEditingAnnotation(null);
    setAnnotationDraft('');
    setAnnotationError('');
  };

  return <main className={`workspace-shell min-h-screen bg-background font-sans text-foreground${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="workspace-header flex min-h-16 flex-wrap items-center gap-3 border-b-4 border-primary bg-sidebar px-4 py-3 text-sidebar-foreground sm:px-7">
      <Logo />
      <div className="ml-auto flex items-center gap-2">
        <div className="header-account" title={session?.user?.email ?? 'Signed-in account'}>
          <UserRound className="header-account-icon" />
          <div className="header-account-copy">
            <strong>{session?.user?.email ?? 'Signed-in account'}</strong>
            <span>{roleLabels[currentRole]}</span>
          </div>
        </div>
        <Button data-testid="button-print-sheet" className="header-print" variant="secondary" size="sm" aria-label="Print sheet" onClick={() => window.print()}><Printer /><span className="header-action-label">Print sheet</span></Button>
        <Button data-testid="button-open-reports" variant="secondary" size="sm" aria-label={canEditReports ? 'Add data' : 'View data'} onClick={() => setShowReports(true)}>{canEditReports ? <FilePlus2 /> : <FolderOpen />}<span className="header-action-label hidden sm:inline">{canEditReports ? 'Add data' : 'Data'}</span></Button>
        {currentRole === 'admin' && <Button data-testid="button-open-users" variant="secondary" size="sm" aria-label="Manage users" onClick={() => setShowUsers(true)}><Users /><span className="header-action-label hidden sm:inline">Users</span></Button>}
        <Button data-testid="button-open-password" variant="secondary" size="sm" aria-label="Change password" onClick={() => setShowPassword(true)}><KeyRound /><span className="header-action-label hidden sm:inline">Change password</span></Button>
        <Button data-testid="button-sign-out" variant="secondary" size="icon" aria-label={`Sign out ${session?.user?.email ?? roleLabels[currentRole]}`} onClick={signOut}><LogOut /></Button>
      </div>
    </header>

    {clipsLoading || clipsError || (!selected && clips.length === 0) ? <section className="grid min-h-[calc(100vh-4rem)] place-items-center bg-card px-6 text-center">
      <div className="max-w-lg">
        <p className="font-serif text-xs font-bold uppercase tracking-[0.18em] text-primary">Archive connection</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">{clipsLoading ? 'Loading live archive' : clipsError ? 'Archive unavailable' : 'Your archive is empty'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{clipsLoading ? 'Loading your Re-Air archive…' : clipsError ? 'Your Re-Air archive could not be loaded.' : 'Add a CSV to begin guided review.'}</p>
        {clipsError && <Button className="mt-5" onClick={() => void refetchClips()}>Retry archive</Button>}
        {!clipsLoading && !clipsError && canEditReports && <Button className="mt-5" onClick={() => setShowReports(true)}>Add data</Button>}
      </div>
    </section> : !selected ? <section className="grid min-h-[calc(100vh-4rem)] place-items-center bg-card px-6 text-center">
      <div className="max-w-lg">
        <p className="font-serif text-xs font-bold uppercase tracking-[0.18em] text-primary">Review queue</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">No clips match this filter</h1>
        <p className="mt-2 text-sm text-muted-foreground">There are no clips in the current search or disposition filter.</p>
        <Button className="mt-5" onClick={() => { setQuery(''); setDispositionFilter('all'); }}>Clear filters</Button>
      </div>
    </section> : <>
      <section className="workspace-progress grid items-center gap-4 border-b bg-card px-4 py-3 sm:px-7 lg:grid-cols-[1fr_minmax(14rem,24rem)_auto]" aria-label="Review progress and disposition filters">
        <div />
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`${reviewed} of ${clips.length} clips reviewed`} aria-valuemin={0} aria-valuemax={clips.length} aria-valuenow={reviewed}>
            <div className="h-full bg-primary transition-[width]" style={{ width: `${clips.length ? reviewed / clips.length * 100 : 0}%` }} />
          </div>
        </div>
        <div className="font-mono text-xs">{reviewed} / {clips.length} resolved</div>
      </section>

       <div className="workspace-grid grid min-h-0 grid-cols-1 lg:grid-cols-[26.25rem_minmax(0,1fr)] xl:grid-cols-[26.25rem_minmax(0,1fr)_47.5rem]">
        <aside className="workspace-queue bg-sidebar p-4 text-sidebar-foreground">
          <div className="queue-heading">
            <div>
              <p className="px-1 font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/70">Review queue</p>
              <p className="queue-heading-count">{view.length} clip{view.length === 1 ? '' : 's'} to review</p>
            </div>
            <span className="queue-heading-total">{clips.length} total</span>
          </div>
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
           <div className="queue-results mt-3 h-[calc(100vh-14rem)] overflow-y-auto">
           <div className="grid gap-1 pr-3">{view.map((clip) => <Button key={clip.id} variant={selectedId === clip.id ? 'default' : 'ghost'} className={`queue-clip h-auto w-full justify-start whitespace-normal text-left ${queueDispositionClass(decisions[clip.id])}`} data-testid={`button-open-clip-${clip.id}`} data-disposition={decisions[clip.id]} aria-label={`Open clip ${clip.id}`} onClick={() => { setSelectedId(clip.id); setMobileDetailTab('overview'); setMobileDetailOpen(true); }}>
                <span className="queue-clip-content min-w-0 wrap-text">
                  <span className="queue-clip-heading"><span className="queue-clip-id break-words font-mono">{clip.id}</span>{clip.revision && <span className="revision">{clip.revision}</span>}<ChevronRight className="queue-clip-arrow" /></span>
                  <span className="queue-clip-airdate"><Clock3 /><span><small>Original airdate</small>{formatDate(clip.originalAir)}</span></span>
                  <span className="queue-clip-people break-words">{[...clip.hosts, ...clip.guests].join(' · ') || 'Host / guests not recorded'}</span>
                  {decisions[clip.id] ? <span className={`queue-disposition-label ${queueDispositionClass(decisions[clip.id])}`}>{decisions[clip.id]}</span> : <span className="queue-clip-flags">{`${clip.flagCount} archive note${clip.flagCount === 1 ? '' : 's'}`}</span>}
                </span>
            </Button>)}</div>
          </div>
        </aside>

         <section className="workspace-detail min-w-0 max-h-[calc(100vh-9rem)] overflow-y-auto border-r border-border px-5 py-8 sm:px-8 lg:px-10 xl:px-12">
           <div className="mobile-detail-view">
             <div className="mobile-detail-nav">
               <Button data-testid="button-mobile-back-to-clips" className="mobile-back-to-clips" variant="ghost" size="sm" onClick={() => setMobileDetailOpen(false)}><ChevronLeft /> All clips</Button>
               <Button data-testid="button-mobile-next-clip" variant="outline" size="sm" onClick={nextClip} disabled={selectedIndex >= view.length - 1}><span>Next clip</span><ChevronRight /></Button>
             </div>
             <section className="mobile-review-summary">
               <div className="mobile-detail-heading">
                 <div className="mobile-detail-title">
                   <p className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-destructive">Now reviewing · clip {selectedIndex + 1} of {clips.length}</p>
                   <h1>{selected.id}</h1>
                 </div>
                 <div className={`verdict ${selected.sensitiveNotes.length ? 'review' : 'clear'}`}><i />{selected.sensitiveNotes.length ? `Needs review — ${selected.sensitiveNotes.length} item${selected.sensitiveNotes.length > 1 ? 's' : ''}` : 'No date-sensitive items flagged'}</div>
               </div>
             </section>
             <section className="mobile-context-summary">
               <div className="mobile-section-heading"><h2>Supporting context</h2><span>Shared archive record</span></div>
               <dl>
                 <div><dt>Clip date</dt><dd>{selected.date ? formatDate(selected.date) : 'Not listed'}</dd></div>
                 <div><dt>Original airdate</dt><dd>{formatDate(selected.originalAir)}</dd></div>
                 <div><dt>Last aired</dt><dd>{formatDate(selected.lastAir)}</dd></div>
                 <div><dt>Host / guests</dt><dd>{people.join(' · ') || 'Not recorded'}</dd></div>
               </dl>
             </section>
             <div className="mobile-detail-tabs" role="tablist" aria-label="Clip information">
               <button id="tab-mobile-overview" data-testid="tab-mobile-overview" type="button" role="tab" aria-selected={mobileDetailTab === 'overview'} aria-controls="mobile-overview-panel" onClick={() => setMobileDetailTab('overview')}>Overview</button>
               <button id="tab-mobile-dated-information" data-testid="tab-mobile-dated-information" type="button" role="tab" aria-selected={mobileDetailTab === 'dated'} aria-controls="mobile-dated-panel" onClick={() => setMobileDetailTab('dated')}>Dated information <span>{notes.length}</span></button>
             </div>
             {mobileDetailTab === 'overview' ? <div id="mobile-overview-panel" className="mobile-tab-panel" role="tabpanel" aria-labelledby="tab-mobile-overview">
               <section className="mobile-detail-section">
                 <div className="mobile-section-heading"><h2>Synopsis</h2></div>
                 <div className="mobile-synopsis-block">
                   <div><h3>Short</h3><p>{selected.shortSynopsis || 'Not provided.'}</p></div>
                   <div><h3>Full</h3><p>{selected.longSynopsis || 'Not provided.'}</p></div>
                 </div>
               </section>
               <section className="mobile-detail-section">
                 <div className="mobile-section-heading"><h2><StickyNote className="h-4 w-4 text-primary" /> Episode notes</h2><span>{episodeDraft.length} / 10,000</span></div>
                 <p className="mobile-help-text">Shared handoff guidance for the editor preparing this clip.</p>
                 <Textarea
                   className="handoff-textarea mt-3"
                   aria-label="Episode handoff notes"
                   maxLength={10000}
                   value={episodeDraft}
                   onChange={(event) => { setEpisodeDraft(event.target.value); setEpisodeDirty(true); setReviewSaveError(''); }}
                   placeholder={reviewLoading ? 'Loading saved notes…' : 'Add context for the editor…'}
                   disabled={reviewLoading}
                 />
                 <div className="mobile-form-actions">
                   <span className="mobile-help-text">{reviewError ? 'Saved notes are temporarily unavailable.' : 'Notes are shared with every reviewer.'}</span>
                   <Button data-testid="button-mobile-save-episode-notes" size="sm" onClick={saveEpisodeNotes} disabled={!episodeDirty || saveEpisodeReview.isPending || reviewLoading}>{saveEpisodeReview.isPending ? <LoaderCircle className="spin" /> : <Check />}{saveEpisodeReview.isPending ? 'Saving…' : 'Save notes'}</Button>
                 </div>
                 {reviewSaveError && <p className="mt-2 text-xs text-destructive" role="alert">{reviewSaveError}</p>}
               </section>
               <section className="mobile-disposition">
                 <div className="mobile-section-heading"><h2>Editorial disposition</h2></div>
                 <div className="mobile-disposition-options">{dispositionOptions.map((option) => <Button data-testid={`button-mobile-disposition-${option.toLowerCase().replaceAll(' ', '-')}`} key={option} variant={decisions[selected.id] === option ? 'default' : 'outline'} onClick={() => saveDisposition(option)} disabled={reviewLoading || saveEpisodeReview.isPending}>{option}</Button>)}</div>
                 {decisions[selected.id] && <p className="mobile-help-text">Saved for every reviewer as “{decisions[selected.id]}”.</p>}
               </section>
             </div> : <div id="mobile-dated-panel" className="mobile-tab-panel" role="tabpanel" aria-labelledby="tab-mobile-dated-information">
               <section className="mobile-detail-section">
                 <div className="mobile-section-heading"><h2>Material timeline</h2><span>{timelineNotes.length} timecoded</span></div>
                 <div className="mobile-material-timeline">
                   {timelineNotes.length ? <div className="relative mt-5 h-12 border-b-2 border-accent">
                     {timelineNotes.map((note, index) => {
                       const targetKind = note.kind === 'timed' ? 'amber' : 'cyan';
                       const targetId = noteDomId(targetKind, note.index);
                       return <button key={`${note.kind}-${note.tc}-${note.text}-${index}`} type="button" className="absolute bottom-[-0.375rem] z-10 -translate-x-1/2 rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: timelinePosition(note.secs ?? 0) }} onClick={() => document.getElementById(targetId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })} title={`${note.tc} — ${note.text}`} aria-label={`${note.tc}: ${note.text}`}><i className={`block h-3 w-3 rounded-full ring-4 ring-card ${note.kind === 'timed' ? 'bg-primary' : 'bg-accent'}`} /></button>;
                     })}
                   </div> : <p className="mobile-help-text">No timecoded flags on this clip.</p>}
                   <div className="mobile-timeline-scale"><span>00:00</span><span>{timelineNotes.length ? `through ${formatTimelineTime(timelineSpan)}` : 'No timecodes recorded'}</span><span>End</span></div>
                 </div>
               </section>
               <section className="mobile-detail-section">
                 <div className="mobile-section-heading"><h2>Timed material</h2><span>{timedNotes.length}</span></div>
                 {timedNotes.length ? <div className="mobile-review-list">{timedNotes.map((note, index) => {
                   const kind: ReviewNoteKind = 'timed';
                   const noteKey = reviewNoteKey(kind, note);
                   return <ReviewNoteCard key={`${noteKey}-${index}`} canEdit={canEditReports} kind={kind} note={note} annotation={annotationById.get(`${kind}|${noteKey}`)} editing={editingAnnotation?.kind === kind && editingAnnotation.noteKey === noteKey} draft={annotationDraft} error={annotationError} saving={saveAnnotation.isPending} onEdit={() => beginAnnotationEdit(kind, noteKey, annotationById.get(`${kind}|${noteKey}`))} onCancel={cancelAnnotationEdit} onDraftChange={setAnnotationDraft} onSave={() => saveFlagAnnotation(kind, noteKey, annotationDraft.trim(), annotationById.get(`${kind}|${noteKey}`)?.status ?? null)} onStatus={(status) => saveFlagAnnotation(kind, noteKey, annotationById.get(`${kind}|${noteKey}`)?.note ?? '', status)} />;
                 })}</div> : <p className="mobile-help-text">No timed notes were recorded for this clip.</p>}
               </section>
               <section className="mobile-detail-section">
                 <div className="mobile-section-heading"><h2>Date notes</h2><span>{dateNotes.length}</span></div>
                 {dateNotes.length ? <div className="mobile-review-list">{dateNotes.map((note, index) => {
                   const kind: ReviewNoteKind = 'date';
                   const noteKey = reviewNoteKey(kind, note);
                   return <ReviewNoteCard key={`${noteKey}-${index}`} canEdit={canEditReports} kind={kind} note={note} annotation={annotationById.get(`${kind}|${noteKey}`)} editing={editingAnnotation?.kind === kind && editingAnnotation.noteKey === noteKey} draft={annotationDraft} error={annotationError} saving={saveAnnotation.isPending} onEdit={() => beginAnnotationEdit(kind, noteKey, annotationById.get(`${kind}|${noteKey}`))} onCancel={cancelAnnotationEdit} onDraftChange={setAnnotationDraft} onSave={() => saveFlagAnnotation(kind, noteKey, annotationDraft.trim(), annotationById.get(`${kind}|${noteKey}`)?.status ?? null)} onStatus={(status) => saveFlagAnnotation(kind, noteKey, annotationById.get(`${kind}|${noteKey}`)?.note ?? '', status)} />;
                 })}</div> : <p className="mobile-help-text">No date notes were recorded for this clip.</p>}
               </section>
             </div>}
           </div>
           <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
             <span className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-destructive">Now reviewing · clip {selectedIndex + 1} of {clips.length}</span>
             <div className="flex flex-wrap items-center gap-2">
               {canEditReports && <Button variant="destructive" size="sm" onClick={deleteSelectedClip} disabled={removeClip.isPending}><Trash2 />{removeClip.isPending ? 'Deleting…' : 'Delete clip'}</Button>}
               <Button variant="ghost" size="sm" onClick={nextClip}>Skip to next <ChevronRight /></Button>
             </div>
           </div>
           {clipDeleteError && <p className="mt-3 text-xs text-destructive" role="alert">{clipDeleteError}</p>}
           <h1 className="mt-3 break-words font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{selected.id}</h1>
           <p className="mt-2 max-w-none wrap-text break-words text-base leading-7 text-muted-foreground">{selected.shortSynopsis || 'No short synopsis was provided.'}</p>

           <section className="mt-7 min-w-0 border-y border-border py-5">
            <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-primary">Full synopsis</h2>
             <p className="mt-3 max-w-none wrap-text break-words text-sm leading-7 text-muted-foreground">{selected.longSynopsis || 'No full synopsis was provided.'}</p>
          </section>

           <div className="mt-7 border-t border-border pt-5">
             <p className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em]">Material timeline</p>
              <div className="relative mt-5 h-12 border-b-2 border-accent">
                {timelineNotes.map((note, index) => {
                  const targetKind = note.kind === 'timed' ? 'amber' : 'cyan';
                  const targetId = noteDomId(targetKind, note.index);
                  return <button
                    key={`${note.kind}-${note.tc}-${note.text}-${index}`}
                    type="button"
                    className="absolute bottom-[-0.375rem] z-10 -translate-x-1/2 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ left: timelinePosition(note.secs ?? 0) }}
                    onClick={() => document.getElementById(targetId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                    title={`${note.tc} — ${note.text}`}
                    aria-label={`${note.tc}: ${note.text}`}
                  >
                    <i className={`block h-2.5 w-2.5 rounded-full ring-4 ring-background ${note.kind === 'timed' ? 'bg-primary' : 'bg-accent'}`} />
                  </button>;
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[0.65rem] text-muted-foreground">
                <span>00:00</span>
                <span>{timelineNotes.length ? `${timelineNotes.length} timecoded item${timelineNotes.length === 1 ? '' : 's'} · through ${formatTimelineTime(timelineSpan)}` : notes.length ? 'No timecodes recorded' : 'No material flagged'}</span>
                <span>End</span>
              </div>
           </div>

           <section className="mt-7 border-t border-border pt-5">
             <div className="flex flex-wrap items-center justify-between gap-3">
               <div className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /><h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Episode notes</h2></div>
               <span className="font-mono text-[0.65rem] text-muted-foreground">{episodeDraft.length} / 10,000</span>
             </div>
             <p className="mt-2 text-xs leading-5 text-muted-foreground">Shared handoff guidance for the editor preparing this clip.</p>
             <Textarea
               className="handoff-textarea mt-3"
               aria-label="Episode handoff notes"
               maxLength={10000}
               value={episodeDraft}
               onChange={(event) => { setEpisodeDraft(event.target.value); setEpisodeDirty(true); setReviewSaveError(''); }}
               placeholder={reviewLoading ? 'Loading saved notes…' : 'Add context for the editor…'}
               disabled={reviewLoading}
             />
             <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
               <span className="text-xs text-muted-foreground">{reviewError ? 'Saved notes are temporarily unavailable.' : 'Notes are shared with every reviewer.'}</span>
               <Button data-testid="button-save-episode-notes" size="sm" onClick={saveEpisodeNotes} disabled={!episodeDirty || saveEpisodeReview.isPending || reviewLoading}>
                 {saveEpisodeReview.isPending ? <LoaderCircle className="spin" /> : <Check />}
                 {saveEpisodeReview.isPending ? 'Saving…' : 'Save notes'}
               </Button>
             </div>
             {reviewSaveError && <p className="mt-2 text-xs text-destructive" role="alert">{reviewSaveError}</p>}
           </section>

           <section className="workspace-decision mt-7 bg-secondary p-5 text-secondary-foreground">
            <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-primary">Editorial disposition</h2>
             <div className="mt-4 flex flex-wrap gap-2">{dispositionOptions.map((option) => <Button data-testid={`button-disposition-${option.toLowerCase().replaceAll(' ', '-')}`} key={option} variant={decisions[selected.id] === option ? 'default' : 'outline'} onClick={() => saveDisposition(option)} disabled={reviewLoading || saveEpisodeReview.isPending}>{option}</Button>)}</div>
             {decisions[selected.id] && <p className="mt-3 text-xs opacity-70">Saved for every reviewer as “{decisions[selected.id]}”.</p>}
          </section>
        </section>

          <aside className="workspace-context min-w-0 max-h-[calc(100vh-9rem)] overflow-y-auto bg-muted p-5 lg:col-span-2 xl:col-span-1">
          <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Supporting context</h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
             {[['Original airdate', formatDate(selected.originalAir)], ['Last aired', formatDate(selected.lastAir)], ['Host / guests', people.join(' · ') || 'Not recorded']].map(([label, value]) => <div className="min-w-0 py-3" key={label}><dt className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt><dd className="mt-1 wrap-text break-words text-sm leading-5">{value}</dd></div>)}
          </dl>

           <div className="mt-6 grid min-w-0 gap-5 border-t border-border pt-5 xl:grid-cols-2">
             <section className="min-w-0">
              <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Timed material</h2>
                {timedNotes.length ? <div className="mt-3 grid gap-2">{timedNotes.map((note, index) => {
                  const kind: ReviewNoteKind = 'timed';
                  const noteKey = reviewNoteKey(kind, note);
                  return <ReviewNoteCard
                    key={`${noteKey}-${index}`}
                    canEdit={canEditReports}
                    kind={kind}
                    note={note}
                    annotation={annotationById.get(`${kind}|${noteKey}`)}
                    editing={editingAnnotation?.kind === kind && editingAnnotation.noteKey === noteKey}
                    draft={annotationDraft}
                    error={annotationError}
                    saving={saveAnnotation.isPending}
                    onEdit={() => beginAnnotationEdit(kind, noteKey, annotationById.get(`${kind}|${noteKey}`))}
                    onCancel={cancelAnnotationEdit}
                    onDraftChange={setAnnotationDraft}
                    onSave={() => saveFlagAnnotation(kind, noteKey, annotationDraft.trim(), annotationById.get(`${kind}|${noteKey}`)?.status ?? null)}
                    onStatus={(status) => saveFlagAnnotation(kind, noteKey, annotationById.get(`${kind}|${noteKey}`)?.note ?? '', status)}
                  />;
                })}</div> : <p className="mt-3 wrap-text break-words text-sm leading-6 text-muted-foreground">No timed notes were recorded for this clip.</p>}
            </section>
             <section className="min-w-0">
              <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">Date notes</h2>
                {dateNotes.length ? <div className="mt-3 grid gap-2">{dateNotes.map((note, index) => {
                  const kind: ReviewNoteKind = 'date';
                  const noteKey = reviewNoteKey(kind, note);
                  return <ReviewNoteCard
                    key={`${noteKey}-${index}`}
                    canEdit={canEditReports}
                    kind={kind}
                    note={note}
                    annotation={annotationById.get(`${kind}|${noteKey}`)}
                    editing={editingAnnotation?.kind === kind && editingAnnotation.noteKey === noteKey}
                    draft={annotationDraft}
                    error={annotationError}
                    saving={saveAnnotation.isPending}
                    onEdit={() => beginAnnotationEdit(kind, noteKey, annotationById.get(`${kind}|${noteKey}`))}
                    onCancel={cancelAnnotationEdit}
                    onDraftChange={setAnnotationDraft}
                    onSave={() => saveFlagAnnotation(kind, noteKey, annotationDraft.trim(), annotationById.get(`${kind}|${noteKey}`)?.status ?? null)}
                    onStatus={(status) => saveFlagAnnotation(kind, noteKey, annotationById.get(`${kind}|${noteKey}`)?.note ?? '', status)}
                  />;
                })}</div> : <p className="mt-3 wrap-text break-words text-sm leading-6 text-muted-foreground">No date notes were recorded for this clip.</p>}
            </section>
          </div>

        </aside>
      </div>
    </>}

    {showReports && <ReportManager reports={reports} canEdit={canEditReports} onClose={() => setShowReports(false)} />}
    {showUsers && currentRole === 'admin' && session?.user && <UserManager currentUserId={session.user.id} onClose={() => setShowUsers(false)} />}
    {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
  </main>;
}

function ReviewNoteCard({
  canEdit,
  kind,
  note,
  annotation,
  editing,
  draft,
  error,
  saving,
  onEdit,
  onCancel,
  onDraftChange,
  onSave,
  onStatus,
}: {
  canEdit: boolean;
  kind: ReviewNoteKind;
  note: { tc: string; text: string };
  annotation?: ReviewAnnotation;
  editing: boolean;
  draft: string;
  error: string;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onStatus: (status: ReviewAnnotation['status']) => void;
}) {
  const statusLabel = reviewStatusLabel(annotation?.status ?? null);
  const kindLabel = kind === 'timed' ? 'Timed material' : 'Date note';

  return <ContextMenu>
    <ContextMenuTrigger asChild>
      <Card
        className={`review-flag-card${annotation?.status ? ` ${annotation.status}` : ''}${canEdit ? ' review-flag-card-actionable' : ''}`}
        data-testid={`review-flag-${kind}-${note.tc || 'untimed'}`}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? `${annotation?.note ? 'Edit' : 'Add'} note for ${kindLabel.toLowerCase()} at ${note.tc || 'untimed'}` : undefined}
        onClick={(event) => {
          if (!canEdit || editing || (event.target as HTMLElement).closest('button, textarea, input, select')) return;
          onEdit();
        }}
        onKeyDown={(event) => {
          if (!canEdit || editing || (event.target as HTMLElement).closest('button, textarea, input, select')) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onEdit();
          }
        }}
      >
        <CardContent className="grid min-w-0 gap-2 p-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <Badge variant="destructive" className="w-fit">{note.tc || '—'}</Badge>
            {statusLabel && <Badge variant={annotation?.status === 'needs-edit' ? 'destructive' : 'outline'} className="review-status-badge"><CheckCircle2 className="h-3 w-3" />{statusLabel}</Badge>}
          </div>
          <p className="wrap-text break-words text-xs leading-5">{note.text}</p>
          {annotation?.note && <div className="reviewer-note"><MessageSquareText className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" /><p className="wrap-text break-words text-xs leading-5">{annotation.note}</p></div>}
          {editing && <div className="review-note-editor" onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.stopPropagation()}>
            <label htmlFor={`annotation-${kind}-${note.tc || 'untimed'}`} className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">Editor note</label>
            <Textarea
              id={`annotation-${kind}-${note.tc || 'untimed'}`}
              className="handoff-textarea mt-2 min-h-20"
              maxLength={5000}
              autoFocus
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Add a handoff note for this flag…"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[0.6rem] text-muted-foreground">{draft.length} / 5,000</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button type="button" size="sm" onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />}{saving ? 'Saving…' : 'Save note'}</Button>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
          </div>}
          {annotation?.updatedBy && <p className="review-annotation-meta">Shared annotation · updated by {annotation.updatedBy}</p>}
          {canEdit && <div className="mobile-review-actions" onClick={(event) => event.stopPropagation()}>
            <Button type="button" size="sm" variant="ghost" onClick={onEdit} disabled={saving}><MessageSquareText />{annotation?.note ? 'Edit note' : 'Add note'}</Button>
            <Button type="button" size="sm" variant={annotation?.status === 'good-to-re-air' ? 'default' : 'outline'} onClick={() => onStatus('good-to-re-air')} disabled={saving}><CheckCircle2 />Ready</Button>
            <Button type="button" size="sm" variant={annotation?.status === 'needs-edit' ? 'destructive' : 'outline'} onClick={() => onStatus('needs-edit')} disabled={saving}><Flag />Needs edit</Button>
            {annotation?.status && <Button type="button" size="sm" variant="ghost" onClick={() => onStatus(null)} disabled={saving}><X />Clear</Button>}
          </div>}
        </CardContent>
      </Card>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-56">
      <ContextMenuLabel>{kindLabel}</ContextMenuLabel>
      <ContextMenuItem onSelect={onEdit}><MessageSquareText className="mr-2 h-4 w-4" />{annotation?.note ? 'Edit note' : 'Add note'}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onStatus('good-to-re-air')}><CheckCircle2 className="mr-2 h-4 w-4 text-chart-3" />Good to re-air</ContextMenuItem>
      <ContextMenuItem onSelect={() => onStatus('needs-edit')}><Flag className="mr-2 h-4 w-4 text-destructive" />Needs edit</ContextMenuItem>
      {annotation?.status && <ContextMenuItem onSelect={() => onStatus(null)}><X className="mr-2 h-4 w-4" />Clear item status</ContextMenuItem>}
    </ContextMenuContent>
  </ContextMenu>;
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

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const changePassword = useChangeMyPassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (currentPassword.length < 8 || newPassword.length < 8) {
      setError('Passwords must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    changePassword.mutate({
      data: { currentPassword, newPassword },
    }, {
      onSuccess: () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('Your password has been updated.');
      },
      onError: (nextError) => setError(mutationErrorMessage(nextError, 'The password could not be updated.')),
    });
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
    <div className="reports-modal password-modal">
      <div className="modal-header">
        <div>
          <p className="eyebrow">Account security</p>
          <h2 id="password-dialog-title">Change password</h2>
        </div>
        <button className="icon-button" aria-label="Close change password" onClick={onClose}><X /></button>
      </div>
      <form className="upload-panel password-form" onSubmit={submit} noValidate>
        <p className="password-help">Choose a new password for your Re·Air / Praise account.</p>
        <label>Current password<input data-testid="input-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Enter current password" /></label>
        <label>New password<input data-testid="input-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <label>Confirm new password<input data-testid="input-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat new password" /></label>
        {error && <div className="inline-error" data-testid="status-password-error"><AlertCircle />{error}</div>}
        {success && <div className="password-success" data-testid="status-password-success"><CheckCircle2 />{success}</div>}
        <div className="modal-actions"><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button data-testid="button-change-password" className="btn primary" type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? <LoaderCircle className="spin" /> : <KeyRound />}{changePassword.isPending ? 'Updating…' : 'Update password'}</button></div>
      </form>
    </div>
  </div>;
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