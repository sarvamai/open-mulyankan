# `platform/spi/` — `mulyankan-spi`

The provider interfaces. Zero runtime dependencies (`dependencies = []`) — a
rule, not an accident (ADR-0003): provider authors install this package
alone and run its conformance suites without the platform. Never import
`mulyankan_platform` here and never add a runtime dependency.

## What is here

- `descriptor.py` — `ProviderDescriptor`, a frozen dataclass (name, version,
  deterministic, data_handling). Every provider carries one.
- `kms.py` — the `KmsProvider` `Protocol`: `describe`, `encrypt`, `decrypt`,
  `sign`, `verify_signature`.
- `conformance/kms.py` — `run_kms_conformance(provider)`.
- `tests/` — the suite run against a correct provider and several broken
  ones.

## Conformance suites are scripts, not pytest

A suite is a plain function returning failure strings — empty means
conformant. It never raises, never asserts, never imports pytest, and stays
dependency-free so a provider author can run it as a script. `tests/` is the
only place pytest appears; there is no `[dev]` extra here — install pytest
yourself or via `platform/core[dev]`.

## The `kms` contract

- `sign` is deterministic for the same key and input; `verify_signature`
  rejects tampered data and a different key.
- `encrypt` may freshen its nonce per call, so only
  `decrypt(encrypt(p)) == p` must hold — ciphertext bytes need not be
  stable.
- `kms` providers declare `deterministic=True`; the suite enforces it.

## Keeping this file true

Update it when you add an SPI or a suite, change the contract above, or add a
file — and update the package table in `../AGENTS.md`.
