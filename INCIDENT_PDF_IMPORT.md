# Incident PDF import plan (F-HSE-03-01)

## Current form fields

The application stores each incident as one `records` document with `form: "F-HSE-03-01"`, an `f` object, `date`, `serial`, `createdAt`, and `createdBy`. The form fields are: `no`, `date`, `time`, `place`, `injury`, `victim` (linked to an employee when resolvable), `dmgEquip`, `dmgEnv`, `desc`, `causes`, `other`, `immediate`, `resp`, `timeline`, `corrective`, `writer`, `writerJob`, `wDate`, `mgr`, `mgrJob`, and `mgrDate`. It has no table rows. Signatures and approvals must remain empty unless a person signs and approves in the application.

## Safe workflow for the 68-page source

1. **Preserve source**: keep the uploaded PDF read-only and record its SHA-256, page count, and filename in a batch manifest. Do not upload source pages to a third-party OCR service without separate authorization.
2. **Inventory pages**: render locally and classify every page as incident form, continuation, blank, unrelated, or unreadable. A multi-page incident is one incident only when page numbering, incident number, date, or matching details establish that relationship. Record source page numbers for every extracted row.
3. **Extract to staging only**: use OCR/text extraction to populate the CSV template below. Treat every value as unverified. Keep original Arabic text; do not invent missing fields or normalize names into employee links automatically. Record uncertain/illegible values as blank and note them in `review_notes`.
4. **Review against page images**: a reviewer checks every field against its source page, confirms page grouping, and resolves possible duplicate incidents. A second reviewer verifies all rows or, at minimum, every ambiguous, high-severity, injury, and fatality record. Do not infer signatures, approval, cause, injury class, or dates.
5. **Preview and deduplicate**: before writing, show a row-by-row diff including source pages and matched existing incidents. Flag candidates by incident number, then by normalized date + time + victim + place; fuzzy matches require a human decision. Do not silently overwrite existing records.
6. **Explicit confirmation and bounded writes**: an authorized administrator confirms the batch and selected rows. Create records in small batches (for example, 10) with stable import keys derived from source hash + page group. Mark each as `legacyImport: true`, `importBatch`, and `sourcePages`; retain original form values. On retry, skip already-created import keys. Stop on permission/network error and report exact successes and failures.
7. **Post-import reconciliation**: compare staged, imported, skipped, and failed counts; reopen representative records and verify the printable form. Keep a batch manifest and source PDF so the import is auditable. Never auto-approve imported records.

## CSV staging template

Use UTF-8 CSV with a header row. `source_pages` is required. Dates should be ISO `YYYY-MM-DD` where confidently read; preserve the source text in `date_source` if not. `causes` may contain `|`-separated option keys only after a reviewer maps them to the form options; otherwise leave it blank and retain the exact text in `causes_source`.

```csv
source_pages,incident_no,date,time,place,injury,victim,dmgEquip,dmgEnv,desc,causes,other,immediate,resp,timeline,corrective,writer,writerJob,wDate,mgr,mgrJob,mgrDate,review_notes
```

The project ZIP provided for this review contains no 68-page PDF, so the workflow cannot yet be populated or validated against the source document. This document describes the required guarded process; it does not claim that import code or records have been added.
