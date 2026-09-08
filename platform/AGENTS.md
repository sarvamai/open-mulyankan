# `platform/` — Python packages

Two distributions, Python 3.12+, hatchling, no framework beyond FastAPI.
Read the root `AGENTS.md` first; it carries the invariants and the M0 reality.

| Package | Distribution | Depends on |
|---|---|---|
| `platform/spi` | `mulyankan-spi` | **nothing** (`dependencies = []`) |
| `platform/core` | `mulyankan-platform` | `mulyankan-spi`, fastapi, uvicorn, pyyaml |

## The dependency direction is a rule, not an accident

`spi` must never import `mulyankan_platform`, and must keep zero runtime
dependencies. Provider authors — including third parties — install `spi` alone
and run its conformance suites without the platform anywhere near them
(ADR-0003). Adding a dependency to `platform/spi/pyproject.toml`, or reaching
into the core from a conformance suite, breaks that promise silently: the
tests still pass in this repo, where both are installed.

The core, in turn, **never imports a provider**. The only path to a provider is
`ProviderRegistry`, which resolves `"module:attr"` targets from configuration
via `importlib`. If you find yourself writing `import mulyankan_provider_...`
in `platform/core`, that is the bug.

## Layout

```
platform/spi/src/mulyankan_spi/
  descriptor.py            ProviderDescriptor — name, version, deterministic, data_handling
  kms.py                   KmsProvider Protocol (runtime_checkable)
  conformance/kms.py       run_kms_conformance(provider) -> list[str] of failures
platform/core/src/mulyankan_platform/
  registry.py              ProviderRegistry, Binding, RegistryError
  audit/chain.py           AuditEvent, AuditLog, canonical_bytes, compute_hash, verify
  core_api/main.py         build_app / create_app / create_app_from_mapping; GET /healthz only
```

## Working on the audit chain

`audit/chain.py` is the most consequential file in the repo. Things that look
like cleanups but are breaking changes:

- **`canonical_bytes` is a wire format.** Sorted keys, `(",", ":")`
  separators, `ensure_ascii=False`, UTF-8. Changing any of that changes every
  hash ever computed. It is versioned by `CANONICAL_SCHEMA_VERSION`
  (`"draft-v0.1"`), which is covered by the hash; bump it deliberately, never
  as a side effect.
- **The chain rule is `sha256(bytes.fromhex(prev_hash) || link_bytes())`**,
  and `link_bytes()` deliberately excludes the `hash` field. Genesis is 64
  zeros.
- **Events are content-free.** `append(payload=...)` hashes the payload and
  discards it — the payload is never stored. Don't add a field that keeps it.
- The in-memory `AuditLog` is M0 scaffolding, but the M1 database-backed store
  must produce **byte-identical** events and identical verification results,
  so treat its semantics as the specification rather than as a prototype.

## Conformance suites

A suite is a plain function returning a list of failure strings — empty means
conformant. It never raises, never asserts, and never imports pytest, so a
provider author can run it as a script. `run_kms_conformance` also pins two
real contract points worth preserving: signing must be deterministic for the
same key and input, while encryption may freshen a nonce (so ciphertext need
not be stable across calls — only `decrypt(encrypt(p)) == p` must hold).

## Tests

```bash
uv pip install -e platform/spi -e "platform/core[dev]"
python -m pytest platform/spi platform/core -q      # 18 tests: 6 spi, 12 core
```

There is no root pytest configuration; run pytest against the package
directories as above. `platform/core/tests/conftest.py` synthesises an
importable fake provider module (`testkit_fake_provider`) in `sys.modules` so
the registry's `importlib` path can be tested without a real provider. Use
that double rather than adding a provider package to make a test pass — and
note that a stale `.pytest_cache/` may list test names that no longer exist.

Requirement-facing tests carry their requirement ID
(`test_asrevd02_chain_verifies_after_appends`); IDs come from
`docs/traceability.md`.

## Style

Type annotations everywhere, `from __future__ import annotations` where the
existing module has it, frozen dataclasses for value objects, `Protocol` for
SPIs. Docstrings state the contract and cite the requirement ID or ADR that
imposes it — that citation is the point, so keep it when you touch a
docstring. Errors are explicit and typed (`RegistryError`) and refuse rather
than fall back: an unbound capability raises at call time; a malformed binding
raises at startup.
