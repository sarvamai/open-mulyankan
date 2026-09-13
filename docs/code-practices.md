# Code practices — how this repository is written

One page, for humans and coding agents. The goal: a new coder (or agent)
should predict where a thing lives, what a file does, and what a comment
is telling them — before reading it.

Rules are short on purpose. Each carries its *why*, because a rule without
a why gets "fixed" away later.

---

## 1. Where code goes (folder rules)

**One folder = one concern = one thing to hold in your head.**

| I am adding… | It goes in… | Why |
|---|---|---|
| a rule about exams, sessions, sources | `platform/core/src/mulyankan_platform/<feature>/` | the core owns every rule |
| an HTTP endpoint | `platform/core/.../core_api/routers/<feature>.py` | one router file per feature, never a bigger `main.py` |
| a vendor-specific skill (PDF, keys, OCR, a model) | `providers/<skill>-<vendor>/` | plugs are swappable; the core never imports them |
| a shared interface (a job description) | `platform/spi/` | zero dependencies, provider authors install it alone |
| a screen | `apps/web/` (oversight roles) or `apps/client/` (content roles) | one role, one surface (ADR-0011) |
| a deployment artefact | `deploy/` | packaging is not logic |
| a decision's *reason* | `docs/adr/` | decisions outlive PR descriptions |

The dependency direction is the law (ADR-0003): `spi` depends on nothing;
`core` never imports a provider — only the registry resolves one, from
config, at startup.

## 2. File and module rules

- **A file should fit on one or two screens.** When it grows past that,
  split by responsibility, not by size: `main.py` keeps assembly (app
  creation, middleware, lifespan) and nothing else; endpoints live in
  feature routers.
- **Every module starts with a docstring that answers *why this module
  exists***, cites the requirement ID or ADR that imposes its contract, and
  states the part a database-backed rewrite must preserve. `audit/chain.py`
  and `sessions/monitor.py` are the standard to copy.
- **One concept per module.** If the docstring needs "and also…", it is two
  modules.
- Naming: exact, unabbreviated, searchable. `GAP_THRESHOLD`, not `gt`;
  `integrity_view`, not `iview`. Test names carry the requirement ID:
  `test_asrevd02_chain_verifies_after_appends`.

## 3. The five house patterns (use them; name them in review)

These repeat across the codebase. They are the house style.

1. **Refuse, don't fall back.** A malformed binding raises at startup; an
   unbound capability raises at call time; an unknown field is a 422, not
   an ignored extra. Silence hides security bugs; refusal surfaces them.
2. **Derived, never stored.** If a value can be computed from the clock or
   existing state, compute it on read (`silent` in `integrity_view`).
   Stored derived state goes stale and then lies.
3. **Single writer.** One code path may mutate a thing (`sweep` is the only
   writer of gap signals). Every other path is a pure read. Concurrency
   bugs live where writers multiply.
4. **Bounded reads.** No endpoint returns "everything" (`limit` +
   `MAX_PAGE_SIZE`). Unbounded lists are the shape that cannot port to a
   database table later.
5. **Content-free records.** Logs, audit events, exception strings, and
   URLs carry opaque ids and counts — never question text, filenames, or
   actor real names. This is invariant-level law, not style.

## 4. Comments — what belongs, what never does

**Write for a reader who knows Python but not this system.**

Belongs in a comment:
- *the constraint that forces the code's shape* — "the handlers are sync
  `def`, so Starlette runs them concurrently on the threadpool; the lock is
  what becomes the database transaction" (`sessions/monitor.py`)
- *the decision and its date/ADR* when the code would otherwise look wrong
- *the invariant a line must not break* — "never add a field that retains
  the payload" (`audit/chain.py`)
- *what a rewrite must keep* — "the database store must produce
  byte-identical events"

Never in a comment:
- narration of the next line (`# increment counter`) — the code says it
- history (`# changed on …`, `# see PR …`) — git remembers
- commented-out code — delete it; git remembers
- question content, real names, or anything Restricted — same rule as logs

Test: **if deleting the comment loses information git cannot recover, it
belongs; otherwise it doesn't.**

## 5. Typing and data rules

- Annotations everywhere; `mypy`/Pyright clean is the bar (a type error
  caught in review is a bug that never ran).
- Frozen dataclasses for value objects (`AuditEvent`, `SessionSnapshot`);
  plain mutable dataclasses for private state (`_SessionState`).
- `Protocol` for SPIs; `Literal` for small closed sets (`"copy" | "cut" |
  "paste"`); pydantic models with `extra="forbid"` for request bodies.
- Errors are specific exception types raised at the layer that owns the
  rule (`UnknownSessionError`), mapped to HTTP status only at the edge
  (`core_api`), with content-free messages.

## 6. Tests are the specification

- Requirement-facing tests carry the requirement ID in the name; that name
  is the traceability link — keep it true.
- Fakes over real providers: `tests/conftest.py` synthesises
  `testkit_fake_provider` so registry tests need no real plug. Never add a
  provider package to make a test pass.
- The in-memory stores are the specification: the future database store
  must reproduce their semantics (byte-identical events, same errors, same
  idempotency). When behaviour is subtle, the test pins it.

## 7. AGENTS.md practice (for agents and their humans)

- **Nested ownership:** each tree's `AGENTS.md` owns its rules; put a rule
  in the deepest file that fits (`platform/spi/AGENTS.md`, not root, for
  zero-dependency rules). Root carries only repo-wide law.
- **"Keeping this file true" is a contract:** when you add a module, change
  a documented command, or settle an open question, update the file in the
  same PR. **A stale line is worse than no line — it is read as fact.**
- Agents: read the nearest `AGENTS.md` *before* the code; check a path a
  doc names actually exists before importing it (docs plan M6, tree is at
  M0 — the root file lists the gap).
- Commits: `git commit -s`, one concern per PR; decisions become ADRs, not
  PR descriptions; British spelling in prose.

## 8. Simplicity heuristics

- No abstraction before the second use. Two similar blocks are cheaper than
  one wrong interface.
- Prefer data + functions over class hierarchies. This repo has no
  inheritance deeper than an exception.
- Async only where I/O waits (endpoints, the sweeper); CPU work goes to
  worker threads (`asyncio.to_thread`), and the event loop never blocks.
- When something is hard to explain, the fix is usually a better name or a
  smaller function — not a paragraph of comments.
