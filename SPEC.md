# mcquest — spec

Personal MCQ practice bank for Indian competitive maths exams (GATE MA, IIT JAM, CSIR NET).
Static site, no backend, file-based question bank, browser-local history.

## Decisions

- Single user. Static build, deployable later. All attempt data in IndexedDB behind one storage module.
- Build from scratch. No OSS platform adopted (all exam-CBT engines drag a DB + admin-UI authoring stack).
- Maths only. No General Aptitude / CSIR Part A.
- Desktop-first. Palette collapses to a drawer below ~900px. No PWA.

## Stack

- Vite + React + TypeScript + react-router
- KaTeX, client-side rendering (no build-time pre-render)
- IndexedDB via `idb-keyval`, all access through `src/storage.ts`
- `ajv` for schema validation in the check script

## Question bank

```
sources/
  GATE MA/
    2024.json
    assets/2024/fig-17.png
  CSIR NET/
    2023.json
```

Folder name is the display label. URL slug derived (lowercase, spaces to dashes).
Front page lists whatever folders exist — no registry file.

### File shape

```json
{
  "exam": "GATE MA",
  "year": 2024,
  "questions": [
    {
      "id": "gate-ma-2024-17",
      "type": "multi",
      "marks": 2,
      "topic": "eigen",
      "question": "Let $A$ be a $3\\times 3$ matrix ...",
      "image": "fig-17.png",
      "options": ["$1$", "$2$", "$3$", "$4$"],
      "correct": [0, 2],
      "answer": null,
      "note": ""
    }
  ]
}
```

- `id` — omit when authoring; `npm run check` assigns and writes it back. Stable thereafter.
- `type` — optional. Inferred: `answer` present means numeric; `correct.length > 1` means multi;
  otherwise single. Written explicitly only for an MSQ that happens to have one correct option
  (real in GATE/JAM, and it changes both the widget and the negative marking).
- `topic` — second-level slug only. Subject derived via `topics.json`. Unknown slug: warn,
  bucket to `unsorted`, still usable in year-wise and random.
- `answer` — numeric questions. Accepts `2.5`, `{value, tolerance}`, or `{min, max}`.
  Validator normalizes to `{min, max}`. Bare number defaults to 0.01 absolute tolerance.
- `image` — filename inside `<exam>/assets/<year>/`.
- `note` — solution/explanation LaTeX, filled in later.

### topics.json (root, user-maintained, strictly two levels)

```json
{
  "linear-algebra": {
    "label": "Linear Algebra",
    "topics": { "eigen": "Eigenvalues & Eigenvectors", "rank": "Rank & Nullity" }
  }
}
```

### Tooling

- `npm run check` — validates against `schema.json`, assigns missing ids, normalizes numeric
  answers, lists unknown topic slugs with nearest-match guesses, flags every
  `options` + `correct.length === 1` question to confirm it is not an MSQ.
- `npm run build:data` — emits `public/data/index.json` (topics, per-exam-year counts,
  question ids + topic + type) and one file per exam-year. Index drives topic-wise and random
  selection; question text loads only for the test being taken.
- `EXTRACT.md` — paste-alongside-a-PDF prompt producing schema-correct JSON. Embeds the topic
  slug list and few-shot examples of all three question types.

## Marking

Derived from exam + type + marks. Never stored per question.

| Exam | Type | Correct | Wrong |
|---|---|---|---|
| GATE MA | MCQ 1-mark | +1 | −1/3 |
| GATE MA | MCQ 2-mark | +2 | −2/3 |
| GATE MA | MSQ / NAT | +marks | 0 |
| IIT JAM | MCQ 1-mark | +1 | −1/3 |
| IIT JAM | MCQ 2-mark | +2 | −2/3 |
| IIT JAM | MSQ / NAT | +marks | 0 |
| CSIR NET | Part B MCQ | +3 | −0.75 |
| CSIR NET | Part C MSQ | +4.75 | 0 |

Multi-select is all-or-nothing everywhere. No partial credit.
CSIR's "answer only N of M offered" cap is not enforced; `maxAnswered` reserved in the schema.

## Flows

Front page: Random Test · Year-wise · Subject-wise · Bookmarked

- **Year-wise** — pick exam, then a year card. Defaults to exam mode.
- **Subject-wise** — pick topics, then count and timed toggle. Defaults to practice mode.
  Pool smaller than requested count: give everything available and say so before starting.
  No recency exclusion.
- **Random** — same config screen as subject-wise, mixed across all exams and years.
- **Bookmarked** — builds a test from bookmarked questions.

Timer: 120 minutes default for every exam, overridable at test start.
Reveal mode (`immediate` vs `onSubmit`) is a flag on the same player, chosen at test start.

## Player

Left: question, image, options. Right: palette sidebar.

Palette states: grey (unvisited), red outline (visited, unanswered), blue (answered),
purple (marked, unanswered), purple with dot (answered + marked).
Practice mode and the results screen replace blue with green/red.

Controls: Save & Next · Clear Response · Mark for Review & Next · palette click-to-jump.
Keyboard: `1-4` select, `Enter` save & next, `M` mark, `←/→` navigate.

Mid-test state (answers, marks, remaining time) persists on every interaction. Closing the tab
and returning resumes the attempt.

## Results and stats

- Score, per-topic breakdown, question-by-question review.
- `note` auto-expanded on wrong answers, collapsed but available on correct ones.
- Bookmark toggle, available in-test and in review. Permanent, separate from mark-for-review.
- Per-topic accuracy and attempt count, ranked worst-first. Minimum 3 attempts before a topic
  is eligible for the ranking; below that it sits in a "not enough data" list.
- "Practice weakest topics" button generates a test from the bottom of that ranking.
- Per-question time logged from day one. No charts yet.

No export, no cross-attempt comparison view. Attempt history is in IndexedDB, so both are
addable later without a data migration.

## Tests

Marking engine, validator, stats aggregation. Not React components or layout.

## Build order

1. `schema.json`, `npm run check`, `EXTRACT.md`, one real paper converted — unblocks bank filling.
2. Player UI against that paper.
3. Persistence, stats, bookmarks.
