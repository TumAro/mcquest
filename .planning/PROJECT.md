# mcquest

## What This Is

A personal MCQ practice bank for Indian competitive mathematics exams — GATE MA, IIT JAM, and
CSIR NET. It is a static website with no backend: the question bank lives as JSON files in the
repo, and all attempt history lives in the browser. Built for one user (the author) preparing
for GATE, modelled on the exam-day CBT players at examside and examgoal.

## Core Value

Practise real exam papers under real marking rules, and find out which topics are costing marks.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Question bank as JSON files under `sources/<EXAM>/<YEAR>.json`, hand- or LLM-authored
- [ ] `npm run check` validates the bank, assigns missing IDs, normalizes numeric answers
- [ ] `EXTRACT.md` — an LLM prompt that turns a question-paper PDF into schema-correct JSON
- [ ] Exam-style test player: question pane plus a five-state palette sidebar
- [ ] Question types: single-correct MCQ, multi-select MSQ, numeric NAT with tolerance
- [ ] LaTeX rendering throughout, via client-side KaTeX
- [ ] Real marking: per-exam negative marking, all-or-nothing MSQ credit
- [ ] Year-wise, subject-wise, random, and bookmarked test modes
- [ ] Practice mode (immediate feedback) and exam mode (feedback on submit)
- [ ] Mid-test resume after closing the tab
- [ ] Results screen: score, per-topic breakdown, question review with solutions
- [ ] Per-topic accuracy tracking and a worst-first weakness ranking
- [ ] Permanent bookmarks, separate from per-attempt mark-for-review

### Out of Scope

- General Aptitude / CSIR Part A — this bank is maths only
- Non-maths papers (GATE CS, JAM Chemistry, etc.) — out of the author's scope
- User accounts, server, multi-user — single user, browser-local storage
- In-browser question authoring UI — a text editor plus an LLM already does this
- CSIR's "answer only N of M offered" attempt cap — practising maths, not question triage
- Partial credit on multi-select — the real exams give none, and it would flatter the score
- Results export and cross-attempt comparison views — addable later from stored history
- PWA / offline install — desktop-first, browser-local already works offline in practice
- Build-time LaTeX pre-rendering — one question renders at a time; client-side KaTeX is enough

## Context

**Build vs adopt (researched, decided: build).** Every open-source system with a real exam-CBT
player (Moodle, TCExam, Open edX, Canvas, OpenOlat) drags a database, a server runtime, and
admin-UI-first authoring. PrairieLearn has the right file-per-question authoring model but needs
Docker, Postgres, and a Python grader. STACK and WeBWorK solve symbolic answer grading, which is
irrelevant here since answers are pre-authored keys. No GitHub quiz app above 500 stars combines
LaTeX, MSQ/NAT types, and an exam palette. Nothing worth forking; schema shapes borrowed from
Moodle XML (`tolerance`), QTI (interaction/response-type split), and GIFT (authoring minimalism).

**No licensed question data exists.** Searched: every GATE/JAM/CSIR dataset found is either
unlicensed (so all rights reserved by default) or general-GATE rather than maths. The bank gets
filled by LLM-extracting official PDFs, which makes `EXTRACT.md` a first-class deliverable
rather than a convenience.

**Verified exam patterns.** GATE MA: 65 questions, 100 marks, 3 hours; negative marking on MCQ
only (−1/3 on 1-mark, −2/3 on 2-mark), none on MSQ or NAT. IIT JAM: 60 questions, Sections A/B/C.
CSIR NET: Part B +3/−0.75, Part C +4.75 with no negative marking and all-or-nothing multi-select.

**Known gap.** The JAM Section A/B/C marks split came from secondary sources — the official JAM
pattern page returned 404 during research. Spot-check before trusting JAM scores.

**Topic taxonomy.** Strictly two levels (subject, then topic) with short slugs. The user supplies
the slug list; the project ships a placeholder `topics.json` until then.

## Constraints

- **Tech stack**: Vite + React + TypeScript + react-router — a static build deployable anywhere, without the server semantics of a full framework
- **Storage**: Browser-local (IndexedDB) behind a single module — so a future server swap touches one file
- **Rendering**: KaTeX client-side — exam maths sits well inside its coverage
- **Platform**: Desktop-first; the palette collapses to a drawer below ~900px
- **Testing**: Marking engine, validator, and stats aggregation only — the pure functions where a silent bug corrupts a score unnoticed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build from scratch, no OSS fork | Every candidate drags a DB + server or costs more to bend than to build | — Pending |
| Question `type` optional, inferred | `answer` means numeric, `correct.length > 1` means multi; explicit only for a one-correct MSQ, which changes both widget and marking | — Pending |
| IDs auto-assigned by the validator | Author omits them; the check script writes them back and freezes them, so history survives edits | — Pending |
| Unknown topic slugs quarantine, not fail | One bad slug must not block a paper the user wants to attempt tonight | — Pending |
| Marking derived from exam + type + marks | Never stored per question, so a rule fix is one table edit | — Pending |
| 120-minute default timer for every exam | Practice under time pressure matters more than replicating each exam's exact duration | — Pending |
| Single index file plus per-paper question files | Topic and random selection query the index; question text loads only for the test being taken | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-18 after initialization*
