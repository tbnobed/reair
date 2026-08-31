---
name: Self-service password changes
description: Authentication policy for users changing their own Re-Air password.
---

Self-service password changes require the current password, update only the authenticated user's password hash, and preserve the active session.

**Why:** Users need to rotate credentials without losing the review context they currently have open, while current-password verification prevents an unattended session from becoming an account takeover path.

**How to apply:** Keep the endpoint authenticated and identity-derived from the session; never accept a target user ID or log password values. Preserve the existing administrator flow for provisioning other accounts.