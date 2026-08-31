---
name: Editor handoff model
description: Review notes and per-flag decisions belong to the shared merged clip identity.
---

Review handoff data, including the episode disposition, is keyed by the merged clip ID plus each flag's kind and generated note identity, not by a report row.

**Why:** The viewer intentionally merges repeated clip IDs across imported reports, so attaching annotations to one report row would make them disappear or diverge depending on which duplicate was selected.

**How to apply:** Keep episode dispositions, episode notes, and per-flag annotations shared across authenticated reviewers, and derive a flag's identity consistently from its kind, timecode, seconds, and normalized source text.