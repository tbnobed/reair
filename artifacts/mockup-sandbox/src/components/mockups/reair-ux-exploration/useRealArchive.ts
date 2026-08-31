import { useCallback, useEffect, useState } from "react";

export type ArchiveNote = {
  tc: string;
  secs: number | null;
  text: string;
};

export type ArchiveClip = {
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

function messageFromResponse(status: number) {
  if (status === 401) {
    return "Sign in to the Re-Air Report Viewer, then return here to load your archive.";
  }
  return "Your Re-Air archive could not be loaded.";
}

export function useRealArchive() {
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
          message: messageFromResponse(response.status),
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
        message: "Your Re-Air archive could not be loaded. Check the API server and retry.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, retry: load };
}