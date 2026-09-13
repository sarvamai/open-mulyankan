# `providers/` — SPI implementations

One installable distribution per directory, named `<spi>-<implementation>`.
Root `AGENTS.md` has the invariants; `platform/AGENTS.md` has the dependency
rule these packages exist to honour.

| Package | Distribution | Implements |
|---|---|---|
| `extraction-pymupdf` | `mulyankan-provider-pymupdf` | `extraction` |

## The rules that make a provider a provider (ADR-0003)

- **Depend on `mulyankan-spi` and your own libraries. Never on
  `mulyankan-platform`.** A provider that imports the core has inverted the
  architecture, and the mistake passes tests here where both are installed.
- **The core never imports you.** Binding happens through `platform.yaml`,
  resolved by `ProviderRegistry` from a `"module:attr"` string. Nothing in
  `platform/` may name your module — grep for your package name in
  `platform/` and expect no hits.
- **The attr is a factory taking one dict.** The registry calls
  `factory(config)` at startup; raise there for a malformed binding rather
  than failing later.
- **Pass your SPI's conformance suite**, in your own `tests/`. The suite is
  the contract; a provider that skips it is unbound in practice.
- **Providers decide nothing.** You receive inputs and return outputs. You do
  not mutate workflow state, write audit events, or choose whether a page is
  good enough — that judgement belongs to the platform, which is why the
  garbled-text-layer check lives in `mulyankan_platform.ingestion` and not in
  `extraction-pymupdf`.
- **Declare `deterministic` honestly.** Every SPI on a validation or sealing
  path must be deterministic, and the suite checks the claim.

## Content never leaves in a message

Source material is Restricted (DAT-01). A provider that reads documents must
keep their content out of log lines and out of exception messages —
`UnreadableDocument("not a readable PDF: FileDataError")` is right,
appending the bytes or the extracted text is a leak (DAT-03). Test it:
`test_unreadable_bytes_are_refused_without_quoting_them`.

## Adding one

```bash
providers/<spi>-<impl>/
├── pyproject.toml                     # hatchling; deps = mulyankan-spi + yours
├── src/mulyankan_provider_<impl>/
│   ├── __init__.py                    # export the factory
│   └── provider.py
└── tests/test_conformance.py          # run the SPI's suite
```

```bash
uv pip install -e platform/spi -e "providers/<spi>-<impl>[dev]"
python -m pytest providers/<spi>-<impl> -q
```

Then add a row to the table above, a stanza to `platform.yaml.example`, and
the SPI to ADR-0003's table if it is new.

## Keeping this file true

Update the table when you add or rename a package, and this file's rules if
ADR-0003 changes.
