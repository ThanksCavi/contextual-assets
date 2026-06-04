# Case Study CMS Filling Guide

## Collections

Use only these collections for a single Case Study:

- `Case Studies`: main case page and hero/listing content.
- `Case Study Sections`: ordered page sections for one case.
- `Case Study Blocks`: reusable content/layout blocks placed inside sections.
- `Categories`: one category selected on the Case Study.
- `Quick Facts`: short facts selected on the Case Study.

Do not use `Client Logos` or `Lottie Image Sets` for Case Study setup.

## Relationships

```text
Case Study
  -> Category: one reference to Categories
  -> Quick Facts: multi-reference to Quick Facts

Case Study Section
  -> Case Study: one required reference
  -> Blocks: multi-reference to Case Study Blocks

Case Study Block
  -> Case Study: one required reference
```

Sections are ordered by the `Order` number. Blocks render inside a section in the order selected in the section's `Blocks` field.

## Current Published Examples

There are 3 current published, non-archived case studies:

- `TFS Global`
- `BDR`
- `Milrose Consultants`

There is also an archived `Success Story`; treat it as old/reference content, not a current example.

## How To Fill One Case Study

1. Create the `Case Studies` item first.
   Fill required fields: `Name`, `Slug`, `Client Name`, `Title`.

2. Fill the main case fields.
   Add `Meta Description`, `Excerpt`, `Client Logo`, `Featured Image`, `Category`, `Quick Facts`, `Glance About`, `Glance AI Solution`, `Glance Results`, optional PDF/testimonial/project URL.

3. Fill homepage/listing fields if the case should appear on the homepage.
   Use `Featured Project`, `Case Study Spotlight Order`, `Client Description`, `Supporting Image`, `Problem`, `Solution Delivered`, `Business Outcome`.

4. Create sections in `Case Study Sections`.
   Each section must reference the Case Study, have an `Order`, `Nav Label`, `Heading`, optional `Body`, and selected `Blocks`.

5. Create blocks in `Case Study Blocks`.
   Each block must reference the same Case Study and have one `Block Type`. Fill only the fields relevant to that block type.

6. Attach blocks back to their section.
   Open the matching section and add the blocks into its `Blocks` multi-reference in the exact display order.

7. Publish in dependency order.
   Publish Quick Facts/Categories if new, then Blocks, then Sections, then the Case Study.

## Recommended Section Pattern

Use this default structure:

- `01 Challenge`
- `02 Solution`
- `03 Impact`

Milrose also uses an optional `01 Story` before Challenge when a quote-led intro is useful.

Naming convention:

```text
Client / 01 Challenge
Client / 02 Solution
Client / 03 Impact

Client / 02 Solution / Checklist Cards
Client / 03 Impact / Metric Cards
```

## Block Types

Use fields according to `Block Type`:

- `Rich Text`: fill `Rich Text Block`.
- `Image`: fill `Image Block`.
- `Video`: fill `Video Block`.
- `Quote Light` / `Quote Dark`: fill quote label/text/name/details.
- `Stat Cards`, `Stat Cards Small`, `Metric Cards`, `Checklist Cards`, `Timeline`: fill card 1-4 heading/text fields.

Do not mix unrelated field groups in one block. For example, a `Metric Cards` block should use card fields, not quote fields.

## Quick QA

- Section `Case Study` reference matches the parent case.
- Block `Case Study` reference matches the parent case.
- Every block used on the page is selected inside a section.
- Section order is sequential: `1`, `2`, `3`, etc.
- Homepage fields are filled only when `Featured Project` is enabled.
- Legacy plain text fields `Client Details`, `AI Solution Area`, and `Delivery Timeline` should not be the primary source; use `Quick Facts` instead.
