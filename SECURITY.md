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

## Handling

Critical findings block the affected milestone. Fixes land as small PRs with regression
tests named after the requirement they protect.
