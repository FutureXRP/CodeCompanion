# FOUND-MONEY-FROM-FILES.md — get your number today, from athena's history

The one question that decides everything is *how much money is being left on
the table at this practice*. You do not need Tebra, a cloud, or a BAA to answer
it: the deterministic engine runs on your own computer, on three files you
already have the right to, and the patient data never leaves the practice.

This is also exactly how last year's athena history gets into CodeCompanion
after a switch — the same three files, the same command.

---

## The three files

| File | What it is | Where to get it |
|---|---|---|
| **835 (ERA)** | The payers' electronic remittances — what they paid and why, line by line | athena: *Remittance* / ERA area, or the **clearinghouse** portal (download the raw 835 / "ANSI 835" file, not the PDF EOB), or your **billing company** — it is your data and they must hand it over |
| **837** | The claims as submitted | Same places: athena / clearinghouse keep copies. If raw 837s are hard to get, say so — a claims-detail CSV can be adapted |
| **Fee schedule** | Your contracted allowable per CPT, per payer | Your payer contracts. Medicare's is public (CMS Physician Fee Schedule for your locality); most commercial contracts are "X % of Medicare", so one Medicare table plus a multiplier covers most of it |

Ask for **12 months** of 837s and 835s **for the same months**. 90 days gives a
signal; a year gives the answer.

The fee schedule is a CSV with four columns:

```
payer_id,cpt_hcpcs,modifier,contracted_rate
04312,99213,,95.00
04312,99214,,135.00
60054,99213,25,98.50
```

`payer_id` must be the payer's id **as it appears in the 837** (e.g. Medicare's
`04312`), not a name — mismatched payer ids are the number-one reason a first run
finds nothing, and the preflight tells you exactly which ids disagree.

---

## Run it (on a practice-controlled, encrypted computer)

```bash
# 1. Prove the pipeline on the synthetic sample files (no PHI):
npm run found-money:check

# 2. Your files. The two flags are the COMPLIANCE.md gate — set them here, never in the hosted app:
EDI_USE_SAMPLE_FILES=false ALLOW_REAL_PHI=true \
  npm run found-money:check -- --837=claims.edi --835=remits.edi --fees=rates.csv
```

The preflight runs before any dollar figure and tells you whether the files line up:

- **837 / 835 parsed** — counts, service-date range, billed and paid totals.
- **Remittances join to claims** — the 835's claim number must equal the 837's; a low join rate means the two files cover different months or came from different systems.
- **Remittance lines match claim lines** — CPT + modifiers must pair exactly.
- **Contract rates loaded** and **claim lines with a rate** — lines without a rate can be flagged as denied or unanswered, never as underpaid.
- **Payer ids agree across the files** — the fix is almost always renaming the `payer_id` values in the CSV.

Then the number:

```
  TOTAL RECOVERABLE:  $xx,xxx.xx  (n findings on m claims, $yyy,yyy billed)
    underpayments / denials (appealable) / undercoding / unadjudicated (risk)
```

Add `--summary=found-money-summary.csv` for a **de-identified** summary — totals
by payer and by payer × code, no claim numbers, no dates, no names — the one file
you can hand to a partner or a consultant. `npm run found-money -- --csv` gives
the line-by-line worklist for your biller; that one contains claim numbers, so it
stays inside the practice.

---

## Reading the result

- **Small number** (a fraction of a percent of collections): your billing company
  is catching it; the integration is a convenience, not a windfall.
- **Big number**: the single-practice stack pays for itself many times over in
  year one, and the denials and underpayments it lists are the first things to
  appeal — the appeal writer drafts them from the same findings.

Either way you will know, for the cost of a few hours of file-gathering, before
spending a dollar on infrastructure. This is `ROADMAP.md` Phase 0: *"the dollar
figure it produces is the proof of the whole thesis."*
