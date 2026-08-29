---
name: Re-Air role model
description: Durable authorization and archive-sharing rules for Re-Air accounts.
---

Re-Air uses three roles: Administrators manage users and reports, Editors upload and delete reports, and Viewers have read-only access. Reports and clips form a shared workspace archive, while uploader ownership remains recorded for account-deletion cleanup.

**Why:** A Viewer must be useful immediately without uploading private copies, and hiding controls alone is not authorization. The configured administrator also needs a protected recovery path.

**How to apply:** Enforce permissions in API middleware, treat `ADMIN_EMAIL` as an Administrator that cannot be demoted or deleted, re-read roles for protected requests, and keep active clients refreshing session state so their controls follow role changes.