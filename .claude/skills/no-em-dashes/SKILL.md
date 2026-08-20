---
name: no-em-dashes
description: House style for Bite Buddy - never write an em dash. Use when writing or editing any text in this repository: interface copy, code comments, commit messages, README and docs, test names, or anything else that ends up as prose. Also use when reviewing a diff for style.
---

# No em dashes

This repository does not use em dashes. Not in the interface, not in comments,
not in the README, not in commit messages. There was a period when they were
everywhere and they have all been taken out; the job now is keeping them out.

## The rule

Never write `—`. Never write `--` as a stand-in for one either.

Also avoid the en dash `–` in prose. A range reads better written out: "3 to 5
days a week", not "3–5 days a week".

## What to write instead

An em dash is nearly always doing the job of a comma, a colon, a full stop or a
pair of brackets. Pick whichever the sentence actually wants:

| The dash was doing this | Write this instead |
|---|---|
| Introducing an explanation | A colon: `Weights are raw: grains and meat before cooking.` |
| Joining a short aside | A comma: `Nothing yet, add a food and the numbers fill in.` |
| Starting a new thought | A full stop: `Signed out. Everything here is kept on this device.` |
| Wrapping a parenthetical | Brackets: `written as lines (150 g apple, 10 g cashews), so they` |

Do not simply swap the dash for a hyphen. `Signed out - everything here is kept
on this device` reads as a typo. Rewrite the sentence so it does not want a dash
at all, which almost always makes it shorter and plainer.

## Worked examples from this repository

```
before  Nothing yet — search above, or just type it in by hand.
after   Nothing yet. Search above, or just type it in by hand.

before  What the food is — not when you eat it or how it is served.
after   What the food is, not when you eat it or how it is served.

before  Sedentary — desk job, little exercise
after   Sedentary: desk job, little exercise

before  Your plans write them as lines rather than dishes — 150 g apple,
        10 g cashews — so they are added straight to a day.
after   Your plans write them as lines rather than dishes (150 g apple,
        10 g cashews), so they are added straight to a day.
```

## Where this applies

Everything: `src/`, `e2e/`, `scripts/`, `docs/`, `supabase/`, `.github/`,
`README.md`, `index.html`, and the message on every commit.

The one thing never to rewrite is a quotation. If the dietician's own wording
ever contained an em dash it would stay, because the source lines in
`src/data/generated/` are a record of what was actually written. None of them do
today, so this has not come up.

## The check

`npm run text:check` scans the repository and fails on any em dash, and it runs
as part of `npm run verify` and in CI. If it fails, fix the prose rather than
the check.
