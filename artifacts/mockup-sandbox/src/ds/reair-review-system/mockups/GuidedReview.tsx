import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Flag,
  HelpCircle,
  Printer,
  Search,
  UserRound,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/reair-review-system/components/ui/alert";
import { Badge } from "@workspace/reair-review-system/components/ui/badge";
import { Button } from "@workspace/reair-review-system/components/ui/button";
import {
  Card,
  CardContent,
} from "@workspace/reair-review-system/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/reair-review-system/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/reair-review-system/components/ui/dropdown-menu";
import { Input } from "@workspace/reair-review-system/components/ui/input";
import { Progress } from "@workspace/reair-review-system/components/ui/progress";
import { ScrollArea } from "@workspace/reair-review-system/components/ui/scroll-area";
import { Separator } from "@workspace/reair-review-system/components/ui/separator";

type ArchiveNote = {
  tc: string;
  secs: number | null;
  text: string;
};

type ArchiveClip = {
  id: string;
  reportId: number;
  source: string;
  date: string | null;
  revision: string | null;
  time: string | null;
  originalAir: string | null;
  lastAir: string | null;
  hosts: string[];
  guests: string[];
  shortSynopsis: string;
  longSynopsis: string;
  duplicateLongSynopsis: boolean;
  sensitiveNotes: ArchiveNote[];
  dateNotes: ArchiveNote[];
  flagCount: number;
};

type ArchiveState =
  | { status: "loading"; clips: ArchiveClip[]; message: string }
  | { status: "ready"; clips: ArchiveClip[]; message: string }
  | { status: "signed-out"; clips: ArchiveClip[]; message: string }
  | { status: "error"; clips: ArchiveClip[]; message: string };

type ReviewClip = {
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

const decisions = ["Needs edit", "Hold for context", "Clear for re-air"];

function responseMessage(status: number) {
  if (status === 401) {
    return "Sign in to the Re-Air Report Viewer, then return here to load your archive.";
  }
  return "Your Re-Air archive could not be loaded.";
}

function useRealArchive() {
  const [state, setState] = useState<ArchiveState>({
    status: "loading",
    clips: [],
    message: "Loading your Re-Air archive…",
  });

  const load = useCallback(async () => {
    setState((current) => ({
      status: "loading",
      clips: current.clips,
      message: "Loading your Re-Air archive…",
    }));

    try {
      const response = await fetch("/api/clips", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        setState({
          status: response.status === 401 ? "signed-out" : "error",
          clips: [],
          message: responseMessage(response.status),
        });
        return;
      }

      const clips = (await response.json()) as ArchiveClip[];
      setState({
        status: "ready",
        clips,
        message: clips.length
          ? `${clips.length} real clips loaded from your shared archive.`
          : "Your authenticated archive is empty.",
      });
    } catch {
      setState({
        status: "error",
        clips: [],
        message:
          "Your Re-Air archive could not be loaded. Check the API server and retry.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, retry: load };
}

function displayDate(value: string | null) {
  return value || "Not recorded";
}

function presentClip(clip: ArchiveClip): ReviewClip {
  const people = [...clip.hosts, ...clip.guests];
  return {
    id: clip.id,
    air: displayDate(clip.originalAir),
    people: people.length ? people.join(" · ") : "Host / guests not recorded",
    short: clip.shortSynopsis,
    full: clip.longSynopsis,
    flags: [...clip.sensitiveNotes, ...clip.dateNotes].map((note) => ({
      tc: note.tc || "—",
      text: note.text,
    })),
    dates: clip.dateNotes.map(
      (note) => `${note.tc ? `${note.tc} · ` : ""}${note.text}`,
    ),
    last: displayDate(clip.lastAir),
    source: clip.source,
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <dt className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-5 text-foreground">{value}</dd>
    </div>
  );
}

export function GuidedReview() {
  const archive = useRealArchive();
  const clips = useMemo(
    () => archive.clips.map(presentClip),
    [archive.clips],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [showSynopsis, setShowSynopsis] = useState(false);

  useEffect(() => {
    setSelectedId((current) =>
      current && clips.some((clip) => clip.id === current)
        ? current
        : (clips[0]?.id ?? null),
    );
    setDecision((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) =>
          clips.some((clip) => clip.id === id),
        ),
      ),
    );
  }, [clips]);

  const selectedIndex = Math.max(
    0,
    clips.findIndex((clip) => clip.id === selectedId),
  );
  const clip = clips[selectedIndex];
  const visibleClips = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clips.filter((item) =>
      `${item.id} ${item.people} ${item.short} ${item.flags
        .map((flag) => flag.text)
        .join(" ")}`
        .toLowerCase()
        .includes(term),
    );
  }, [clips, query]);
  const reviewed = clips.filter((item) => decision[item.id]).length;
  const isReady = archive.status === "ready";

  const stateTitle =
    archive.status === "loading"
      ? "Loading live archive"
      : archive.status === "signed-out"
        ? "Sign in required"
        : archive.status === "error"
          ? "Archive unavailable"
          : "Your archive is empty";

  const next = () => {
    if (!clip) return;
    const pending = clips.findIndex(
      (item, index) => index > selectedIndex && !decision[item.id],
    );
    const nextIndex =
      pending >= 0
        ? pending
        : Math.min(selectedIndex + 1, clips.length - 1);
    setSelectedId(clips[nextIndex]?.id ?? null);
    setShowSynopsis(false);
  };

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b-4 border-primary bg-sidebar px-4 py-3 text-sidebar-foreground sm:px-7">
        <div className="whitespace-nowrap font-serif text-sm font-bold uppercase tracking-[0.16em]">
          Re<span className="text-primary">·</span>Air / Review Desk
        </div>
        <div className="hidden border-l border-sidebar-border pl-4 font-mono text-xs text-sidebar-foreground/70 sm:block">
          {isReady
            ? `Live archive · ${clips.length} real clip${clips.length === 1 ? "" : "s"}`
            : "Authenticated archive"}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer />
            Print sheet
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="User menu">
                <UserRound />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Review session</DropdownMenuItem>
              <DropdownMenuItem>Archive settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!isReady || !clip ? (
        <section
          className="grid min-h-[calc(100vh-4rem)] place-items-center bg-card px-6 py-12 text-center"
          aria-live="polite"
          aria-busy={archive.status === "loading"}
        >
          <div className="max-w-lg">
            <p className="font-serif text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {isReady ? "Live archive" : "Archive connection"}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold">{stateTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {archive.message}
            </p>
            {(archive.status === "signed-out" ||
              archive.status === "error") && (
              <Button className="mt-5" onClick={() => void archive.retry()}>
                Retry archive
              </Button>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="grid items-center gap-4 border-b bg-card px-4 py-4 sm:px-7 lg:grid-cols-[1fr_minmax(14rem,24rem)_auto]">
            <div>
              <p className="font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Guided review · Live archive
              </p>
              <p className="mt-1 font-serif text-lg font-bold">
                Resolve each decision before moving on
              </p>
            </div>
            <Progress
              value={clips.length ? (reviewed / clips.length) * 100 : 0}
              aria-label={`${reviewed} of ${clips.length} clips reviewed`}
            />
            <div className="font-mono text-xs">
              {reviewed} / {clips.length} resolved
            </div>
          </section>

          <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)_19rem]">
            <aside className="bg-sidebar p-4 text-sidebar-foreground">
              <p className="px-1 font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/70">
                Review queue · real archive notes
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  aria-label="Search review queue"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a clip or person"
                />
                <Button variant="secondary" size="icon" aria-label="Search">
                  <Search />
                </Button>
              </div>
              <ScrollArea className="mt-3 h-[34rem]">
                <div className="grid gap-1 pr-3">
                  {visibleClips.map((item) => (
                    <Button
                      key={item.id}
                      variant={selectedId === item.id ? "default" : "ghost"}
                      className="h-auto w-full justify-start whitespace-normal text-left"
                      onClick={() => {
                        setSelectedId(item.id);
                        setShowSynopsis(false);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs">
                          {item.id}
                        </span>
                        <span className="mt-1 block truncate text-xs opacity-75">
                          {item.people}
                        </span>
                        <span className="mt-1.5 block font-mono text-[0.65rem] opacity-80">
                          {decision[item.id] ??
                            `${item.flags.length} archive note${item.flags.length === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </Button>
                  ))}
                  {visibleClips.length === 0 && (
                    <p className="px-2 py-5 text-xs leading-5 text-sidebar-foreground/70">
                      No clips match this search.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </aside>

            <section className="min-w-0 border-r border-border px-5 py-8 sm:px-8 lg:px-10 xl:px-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-destructive">
                  Now reviewing · clip {selectedIndex + 1} of {clips.length}
                </span>
                <Button variant="ghost" size="sm" onClick={next}>
                  Skip to next
                  <ChevronRight />
                </Button>
              </div>

              <h1 className="mt-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                {clip.id}
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">
                {clip.short || "No short synopsis was provided."}
              </p>

              {clip.flags.length ? (
                <>
                  <Alert variant="destructive" className="mt-7">
                    <Flag />
                    <AlertTitle>
                      Could this material mislead a listener if aired now?
                    </AlertTitle>
                    <AlertDescription>
                      Review the sensitive and date notes below, then record an
                      editorial disposition.
                    </AlertDescription>
                  </Alert>
                  <p className="mt-6 font-serif text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Archive notes requiring a decision
                  </p>
                  <div className="mt-3 grid gap-3">
                    {clip.flags.map((flag, index) => (
                      <Card key={`${flag.tc}-${index}`}>
                        <CardContent className="grid gap-3 sm:grid-cols-[5rem_1fr]">
                          <Badge variant="destructive">{flag.tc}</Badge>
                          <p className="text-sm leading-6">{flag.text}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <Alert className="mt-7">
                  <HelpCircle />
                  <AlertTitle>
                    No sensitive or date notes were recorded.
                  </AlertTitle>
                  <AlertDescription>
                    Check the supporting history, then clear this clip for the
                    next air window.
                  </AlertDescription>
                </Alert>
              )}

              <section className="mt-6 bg-secondary p-5 text-secondary-foreground">
                <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Editorial disposition
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {decisions.map((option) => (
                    <Button
                      key={option}
                      variant={
                        decision[clip.id] === option ? "default" : "outline"
                      }
                      onClick={() =>
                        setDecision((current) => ({
                          ...current,
                          [clip.id]: option,
                        }))
                      }
                    >
                      {option}
                    </Button>
                  ))}
                </div>
                {decision[clip.id] && (
                  <p className="mt-3 text-xs leading-5 opacity-70">
                    Recorded locally as “{decision[clip.id]}”. The queue is
                    updated; no archive data was changed.
                  </p>
                )}
              </section>
            </section>

            <aside className="bg-muted p-5 lg:col-span-2 xl:col-span-1">
              <h2 className="font-serif text-xs font-bold uppercase tracking-[0.16em]">
                Supporting context
              </h2>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                <Fact label="Original airdate" value={clip.air} />
                <Fact label="Last aired" value={clip.last} />
                <Fact label="Host / guests" value={clip.people} />
                <Fact
                  label="Date notes"
                  value={clip.dates.length ? clip.dates.join(" · ") : "None recorded"}
                />
                <Fact label="Source" value={clip.source} />
              </dl>

              <Collapsible
                className="mt-6"
                open={showSynopsis}
                onOpenChange={setShowSynopsis}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    Full synopsis
                    <ChevronDown
                      className={showSynopsis ? "rotate-180" : undefined}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="pt-4 text-sm leading-6 text-muted-foreground">
                    {clip.full || "No full synopsis was provided."}
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <Separator className="mt-5" />
              <div
                className="relative mt-5 h-12 border-b-2 border-accent"
                aria-label={`${clip.flags.length} archive notes`}
              >
                {clip.flags.slice(0, 8).map((_, index) => (
                  <i
                    key={index}
                    className="absolute bottom-[-0.375rem] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-muted"
                    style={{
                      left: `${((index + 1) / (Math.min(clip.flags.length, 8) + 1)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-muted-foreground">
                <span>00:00</span>
                <span>End</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}