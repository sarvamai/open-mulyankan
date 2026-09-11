# Security Policy

Open Mulyankan exists to keep examination content confidential. Security reports are
taken seriously and handled privately.

## Reporting a vulnerability

Please report privately through GitHub Security Advisories — use the
**Report a vulnerability** button on this repository's Security tab. Do not open a
public issue for a security report.

Include what you found, how to reproduce it, and the impact you assess.

## What we care about most

- Any path to read **sealed question content** by a human role or token
- Bypassing **separation of duties** (self-approval, self-review, self-translation)
- **Audit chain** tampering, removal, or verification bypass
- Question content appearing in **logs, traces, telemetry, or error messages**
- The readiness interface accepting a **human or wrong-audience token**

## Scope

- **In scope:** this repository (the Layer 1 workflow core) and its provider interfaces.
- **Out of scope:** Layer 2 model behaviour and Layer 3 operator infrastructure, which
  are governed by separate contracts with their own owners.

## Known limitations

Recorded here because they are live in `main`, not theoretical, and a reader who
does not know them will assume protection that is not there.

- **The session-monitoring surface is unauthenticated** (`/v1/sessions...`,
  `/v1/integrity/sessions`; ASR02-OBS-01). Nothing validates a caller, the
  `session_id` is the sole bearer for `heartbeat`, `close`, and `signals`, and
  `GET /v1/integrity/sessions` publishes every live one to anybody who asks.
  Anyone who can reach the surface can therefore close another author's session,
  or forge copy/paste signals that deduct their integrity score and append a
  false security event — and the chain is append-only, so that record cannot
  afterwards be corrected.

  Server-side token validation belongs to the identity SPI (ADR-0004) and lands
  with that slice. **Until it does, this surface is development-only and must not
  be reachable from any network an exam taker sits on.**

## Handling

Critical findings block the affected milestone. Fixes land as small PRs with regression
tests named after the requirement they protect.
