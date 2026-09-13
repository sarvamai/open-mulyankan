# `platform/` — Python packages

Python 3.12+, hatchling. Root `AGENTS.md` has the invariants.

| Package | Distribution | Depends on |
|---|---|---|
| `platform/spi` | `mulyankan-spi` | nothing (`dependencies = []`) |
| `platform/core` | `mulyankan-platform` | `mulyankan-spi`, fastapi, uvicorn, pyyaml, python-multipart |
| `providers/extraction-pymupdf` | `mulyankan-provider-pymupdf` | `mulyankan-spi`, pymupdf |

Each package carries its own `AGENTS.md` with the rules that apply only
there — read the one nearest the file you are editing.

## Dependency direction is a rule

- `spi` never imports `mulyankan_platform` and keeps **zero** runtime deps.
  Provider authors install it alone and run its conformance suites without the
  platform (ADR-0003). Breaking this passes tests here, where both are
  installed.
- The core **never imports a provider**. The only path is `ProviderRegistry`,
  resolving `"module:attr"` from config via `importlib`. Writing
  `import mulyankan_provider_...` in `platform/core` is the bug.

## Tests

```bash
uv pip install -e platform/spi -e "platform/core[dev]" \
               -e "providers/extraction-pymupdf[dev]"
python -m pytest platform providers -q
```

No root pytest config — point it at the package dirs. A stale
`.pytest_cache/` may list tests that no longer exist.

## Style

Annotations everywhere; frozen dataclasses for value objects; `Protocol` for
SPIs. Docstrings cite the requirement ID or ADR that imposes the contract —
keep the citation when you edit one. Errors refuse rather than fall back: an
unbound capability raises at call time, a malformed binding at startup.

## Keeping this file true

Update it when you add an SPI or a package, change the dependency rule, or
move the test entry points.
