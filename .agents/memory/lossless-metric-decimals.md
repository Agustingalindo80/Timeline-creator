---
name: Lossless metric decimals
description: Numeric integrity rules for structured Business Outcome metrics and legacy migration.
---

Treat structured metric values as decimal strings at API boundaries. Only migrate legacy values when their syntax, precision, and range are exactly representable by the structured decimal column; malformed or over-precision values must remain visible in the legacy fallback rather than being coerced.

**Why:** JavaScript numbers can lose decimal precision before validation, PostgreSQL can silently round excess fractional digits, and one unsafe cast can abort a whole migration batch.

**How to apply:** Use strict decimal-string validation for metric APIs, imports, and future bulk operations. Validate original legacy text before removing an optional trailing unit marker, and skip—not normalize—values that cannot be represented exactly.