---
name: AI report ingestion ownership
description: Security and archive-ownership rules for machine-submitted reports
---

Machine report ingestion is intentionally separate from browser session uploads: it requires a dedicated bearer token and attributes the imported data to the configured administrator account.

**Why:** An AI system cannot depend on a browser session, while the archive schema requires a real user owner and the machine credential must not silently inherit an arbitrary viewer identity.

**How to apply:** Keep the direct ingestion credential out of the viewer UI and route machine submissions through the shared parser, file storage, and transaction path. Preserve cookie/session authentication for manual browser uploads.