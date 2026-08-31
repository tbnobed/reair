export type ParsedNote = { tc: string; secs: number | null; text: string };

export type ParsedClip = {
  clipKey: string;
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
  sensitiveNotes: ParsedNote[];
  dateNotes: ParsedNote[];
  flagCount: number;
};

const COL = {
  id: "ClipID",
  air: "Air Dates",
  host: "Host",
  guests: "Guests",
  short: "Short Synopsis",
  long: "Long Synopsis",
  dates: "Any dates mentioned (timecode where)",
  sens: "Any date sensitive material (timecode where)",
} as const;

function parseCSV(text: string): Record<string, string>[] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let index = 0;
  let quoted = false;

  while (index < input.length) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index++;
        continue;
      }
      field += character;
      index++;
      continue;
    }
    if (character === '"') {
      quoted = true;
      index++;
      continue;
    }
    if (character === ",") {
      row.push(field);
      field = "";
      index++;
      continue;
    }
    if (character === "\r") {
      index++;
      continue;
    }
    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index++;
      continue;
    }
    field += character;
    index++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];

  const header = rows.shift()!.map((value) => value.trim());
  return rows
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const record: Record<string, string> = {};
      header.forEach((name, column) => {
        record[name] = (values[column] ?? "").trim();
      });
      return record;
    });
}

function tcSeconds(timecode: string): number {
  const parts = timecode.split(":").map(Number);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

function parseNotes(value: string | undefined): ParsedNote[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[—–-]\s*(.*)$/);
      return match
        ? { tc: match[1], secs: tcSeconds(match[1]), text: match[2] }
        : { tc: "", secs: null, text: line };
    })
    .sort((left, right) => (left.secs ?? 1e9) - (right.secs ?? 1e9));
}

function parseClipId(id: string): {
  date: string | null;
  revision: string | null;
  time: string | null;
} {
  const match = id.match(/P(\d{2})(\d{2})(\d{2})(R\d*)?-(\d{2})(\d{2})(\d{2})/);
  if (!match) return { date: null, revision: null, time: null };
  return {
    date: `20${match[1]}-${match[2]}-${match[3]}`,
    revision: match[4] ?? null,
    time: `${match[5]}:${match[6]}:${match[7]}`,
  };
}

function parseAirDates(value: string | undefined): {
  original: string | null;
  last: string | null;
} {
  if (!value) return { original: null, last: null };
  const originalMatch = value.match(/Original:\s*([\d-]+)/);
  const lastMatch = value.match(/Last:\s*([\d-]+)/);
  if (!originalMatch && !lastMatch) return { original: value, last: null };
  return {
    original: originalMatch?.[1] ?? null,
    last: lastMatch?.[1] ?? null,
  };
}

function splitPeople(value: string | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((person) => person.trim())
    .filter(Boolean);
}

function mergeStrings(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right].map((value) => value.trim()).filter(Boolean))];
}

function mergeNotes(left: ParsedNote[], right: ParsedNote[]): ParsedNote[] {
  const unique = new Map<string, ParsedNote>();
  for (const note of [...left, ...right]) {
    const normalizedText = note.text.trim();
    const key = `${note.tc}|${note.secs ?? ""}|${normalizedText.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, { ...note, text: normalizedText });
  }
  return [...unique.values()].sort((a, b) => (a.secs ?? 1e9) - (b.secs ?? 1e9));
}

function preferText(left: string, right: string): string {
  return left.length >= right.length ? left : right;
}

export function mergeParsedClips(clips: ParsedClip[]): ParsedClip[] {
  const merged = new Map<string, ParsedClip>();
  for (const clip of clips) {
    const existing = merged.get(clip.clipKey);
    if (!existing) {
      merged.set(clip.clipKey, clip);
      continue;
    }

    const shortSynopsis = preferText(existing.shortSynopsis, clip.shortSynopsis);
    const longSynopsis = preferText(existing.longSynopsis, clip.longSynopsis);
    const sensitiveNotes = mergeNotes(existing.sensitiveNotes, clip.sensitiveNotes);
    const dateNotes = mergeNotes(existing.dateNotes, clip.dateNotes);
    merged.set(clip.clipKey, {
      ...existing,
      date: existing.date ?? clip.date,
      revision: existing.revision ?? clip.revision,
      time: existing.time ?? clip.time,
      originalAir: existing.originalAir ?? clip.originalAir,
      lastAir: existing.lastAir ?? clip.lastAir,
      hosts: mergeStrings(existing.hosts, clip.hosts),
      guests: mergeStrings(existing.guests, clip.guests),
      shortSynopsis,
      longSynopsis,
      duplicateLongSynopsis: !longSynopsis
        && (existing.duplicateLongSynopsis || clip.duplicateLongSynopsis),
      sensitiveNotes,
      dateNotes,
      flagCount: sensitiveNotes.length + dateNotes.length,
    });
  }
  return [...merged.values()];
}

export function parseReport(content: string): ParsedClip[] {
  const rows = parseCSV(content);
  const clips = rows
    .filter((row) => row[COL.id])
    .map((row) => {
      const id = row[COL.id];
      const parsedId = parseClipId(id);
      const sensitiveNotes = parseNotes(row[COL.sens]);
      const dateNotes = parseNotes(row[COL.dates]);
      const airDates = parseAirDates(row[COL.air]);
      const shortSynopsis = row[COL.short] ?? "";
      const longSynopsis = row[COL.long] ?? "";
      return {
        clipKey: id,
        ...parsedId,
        originalAir: airDates.original,
        lastAir: airDates.last,
        hosts: splitPeople(row[COL.host]),
        guests: splitPeople(row[COL.guests]),
        shortSynopsis,
        longSynopsis: longSynopsis !== shortSynopsis ? longSynopsis : "",
        duplicateLongSynopsis: Boolean(longSynopsis && longSynopsis === shortSynopsis),
        sensitiveNotes,
        dateNotes,
        flagCount: sensitiveNotes.length + dateNotes.length,
      };
    });
  return mergeParsedClips(clips);
}