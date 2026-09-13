# Canonicalization — the byte format behind every audit hash

Status: **draft-v0.1** — the version implemented by
`platform/core/src/mulyankan_platform/audit/chain.py` (`CANONICAL_SCHEMA_VERSION`).

This document specifies the canonical byte format that audit-chain hashes are
computed over. It is normative: **changing any byte of this format changes
every audit hash ever computed**, which is why the format is versioned and
the version is covered by the hash itself. Bump `CANONICAL_SCHEMA_VERSION`
deliberately, with an ADR, never silently.

## 1. Canonical JSON

`canonical_bytes(document)` produces the exact bytes a hash covers:

1. Object keys sorted by Unicode code point (`json.dumps(..., sort_keys=True)`).
2. No whitespace: `,` between items, `:` between key and value
   (`separators=(",", ":")`).
3. Non-ASCII characters kept as UTF-8, never escaped
   (`ensure_ascii=False`), encoded `.encode("utf-8")`.
4. No trailing newline.

These four choices are the whole format. Two independent implementations
that follow them produce byte-identical output for the same document — that
is the property the chain depends on.

## 2. What one event hashes

An `AuditEvent` carries: `event_id`, `seq`, `ts`, `actor`, `action`,
`object_refs`, `payload_hash`, `prev_hash`, `hash`.

- **`link_bytes()`** = canonical JSON of every field **except `hash`**,
  plus `canonical_schema_version`, with this exact key set:
  `action, actor, canonical_schema_version, event_id, object_refs,
  payload_hash, prev_hash, seq, ts`.
- **`hash`** = `sha256( bytes.fromhex(prev_hash) ‖ link_bytes() )`,
  hex-encoded. The previous event's hash enters as **raw 32 bytes**, not as
  ASCII hex.

## 3. Field rules

| Field | Rule |
|---|---|
| `canonical_schema_version` | String, currently `"draft-v0.1"`. Covered by the hash; bump deliberately. |
| `event_id` | UUID4 hex, 32 chars, lowercase. |
| `seq` | 0-based position in the chain. `verify` requires `seq == index`. |
| `ts` | RFC 3339 UTC, millisecond precision, `Z` suffix (`2026-09-13T09:53:11.168Z`). |
| `actor` | Pseudonymous workforce identifier (DAT-02) — never a real name. |
| `action` | Dotted lowercase verb (`session.registered`, `session.signal.copy`). |
| `object_refs` | Tuple of opaque identifiers — **never content** (ASR01-EVD-09, DAT-03). |
| `payload_hash` | `sha256(canonical_bytes(payload))` hex, or `""` when there is no payload. The payload itself is **discarded after hashing**; no field may retain it. |
| `prev_hash` | The previous event's `hash`, or genesis for `seq` 0. |
| `hash` | Computed last; excluded from `link_bytes()`. |

**Genesis** is 64 ASCII zeros:
`0000000000000000000000000000000000000000000000000000000000000000`.

## 4. Worked example

One event appended through the real code (`AuditLog.append`, no payload):

```
event_id     f84be84da0384fd1ab00c036fa79cc6b
seq          0
ts           2026-09-13T09:53:11.168Z
actor        author-001
action       session.registered
object_refs  ["9f3c1e2a"]
payload_hash ""            (no payload)
prev_hash    0000…0000     (genesis, 64 zeros)
```

`link_bytes()` — 302 bytes, keys sorted, no spaces:

```
{"action":"session.registered","actor":"author-001","canonical_schema_version":"draft-v0.1","event_id":"f84be84da0384fd1ab00c036fa79cc6b","object_refs":["9f3c1e2a"],"payload_hash":"","prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","seq":0,"ts":"2026-09-13T09:53:11.168Z"}
```

`hash = sha256( bytes.fromhex(prev_hash) ‖ link_bytes() )`:

```
53f3a197c35a448f968b28c0ff84a54b8d6e64f5d6562d3b7d504d40435607ae
```

(`event_id` and `ts` differ per append; the byte layout and hash rule do
not. Reproduce with `AuditLog` + `compute_hash` from `audit/chain.py`.)

## 5. Verification

`verify(events)` recomputes the full chain and fails on the first bad
event with one of exactly three reasons:

- `sequence gap` — `seq != index` (an event was removed, or two writers
  minted the same `seq`);
- `broken link` — `prev_hash` does not match the previous event's `hash`;
- `hash mismatch` — the event's bytes were altered after the fact.

A chain that verifies is evidence that **nothing was altered or removed** —
and, because events are content-free, it proves that without ever exposing
what happened.

## 6. What the database store inherits (M1)

The in-memory `AuditLog` is the specification: the database-backed store
must produce **byte-identical events** — same canonical bytes, same hash
rule, same field rules — and the same `verify` results. The append must be
a serialised sequence under concurrency (a database constraint, not an
advisory convention), so two writers can never mint the same `seq` and
`prev_hash`.
