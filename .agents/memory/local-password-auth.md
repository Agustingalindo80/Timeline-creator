---
name: Local password auth migration
description: Constraints and gotchas from replacing Replit OIDC with email/password login
---

- The rule: any endpoint that returns a `users` row must strip `passwordHash` (sanitize at the route level; storage returns full rows). **Why:** RBAC user-management endpoints leaked hashes when the column was added. **How to apply:** when adding any new user-returning endpoint, run the response through the sanitizer.
- Session cookies are `secure: true`; curl tests against localhost must send `X-Forwarded-Proto: https` or express-session silently omits Set-Cookie (trust proxy is on; real traffic goes through Replit's https proxy).
- The `/t/:slug/api/*` URL-rewrite middleware must be registered BEFORE auth routes, or tenant-prefixed login URLs never match the login handler.
- Forced password change: server skips the currentPassword check only while `must_change_password` is true; client gates the whole app on that flag.
- After republish, production users have no password hashes — the owner's password must be set directly in the prod DB (same UPDATE used in dev) or they are locked out.
