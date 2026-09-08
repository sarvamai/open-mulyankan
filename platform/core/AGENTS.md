# `platform/core/` — `mulyankan-platform`

The workflow core: provider registry, hash-chained audit log, and the FastAPI
`core_api` (M0: `GET /healthz` only — domain surfaces arrive with M1).

## What is here

- `registry.py` — `ProviderRegistry` resolves `"module:attr"` bindings from
  `platform.yaml` via `importlib`. The core never imports a provider any
  other way; malformed or unloadable bindings raise at startup, an unbound
  capability at call time.
- `audit/chain.py` — the append-only audit chain (below).
- `core_api/main.py` — reads `platform.yaml`
  (`$MULYANKAN_PLATFORM_CONFIG`); no such file is committed, and with none
  the app starts with zero bindings.
- `tests/` — registry, audit-chain, and healthz tests; requirement-facing
  names carry their ID (`test_asrevd02_...`).

## `audit/chain.py` is wire format, not style

- `canonical_bytes`: sorted keys, `(",", ":")`, `ensure_ascii=False`, UTF-8.
  Changing any of it changes every hash ever computed. Versioned by
  `CANONICAL_SCHEMA_VERSION` (`draft-v0.1`), which the hash covers; bump
  deliberately.
- Chain rule: `sha256(bytes.fromhex(prev_hash) || link_bytes())`, where
  `link_bytes()` excludes the `hash` field. Genesis is 64 zeros.
- `append(payload=...)` hashes the payload and discards it. Never add a
  field that retains it — events stay content-free (opaque refs + payload
  hash).
- The in-memory `AuditLog` is M0 scaffolding; M1's database store must
  produce byte-identical events. Treat its semantics as the specification.

## Tests

`tests/conftest.py` synthesises an importable `testkit_fake_provider` in
`sys.modules` so the registry's `importlib` path is testable without a real
provider; use that double rather than adding a provider package to make a
test pass.

```bash
python -m pytest platform/core -q
```

## Keeping this file true

Update it when you add a module or endpoint, touch the canonicalization or
chain rule, or change how tests fake a provider.
