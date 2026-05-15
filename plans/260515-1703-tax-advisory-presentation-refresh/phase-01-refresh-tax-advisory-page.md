# Phase 01 - Refresh Tax Advisory Page

## Context Links
- `README.md`
- `/Users/felix/Downloads/ella.tax company presentation.md`
- `apps/landing/src/pages/tax-advisory.astro`
- `apps/landing/src/components/tax-advisory/*`
- `apps/landing/src/config/tax-advisory-presentation.ts`

## Overview
- Priority: High
- Status: complete
- Expand the private tax advisory page so it follows the deck more closely and reads like a longer client presentation.

## Key Insights
- Deck text extraction is noisy, but core concepts are readable: smarter tax decisions, maximize strategies, accountability, revenue/profit planning, tax burden monitoring.
- Deck flow includes client experience, overpayment reasons, engagement flow, first 30 days, 31-90, 91-180, 181-270, 271-365, implementation tasks, and return/filing closeout.

## Requirements
- Rewrite page copy to align with deck language.
- Add more sections/page-like blocks.
- Make client process and year-one roadmap more detailed.
- Keep content professional and client-facing.
- Avoid claims that guarantee savings.

## Related Code Files
- Modify `apps/landing/src/pages/tax-advisory.astro`
- Modify `apps/landing/src/config/tax-advisory-presentation.ts`
- Modify existing tax advisory components
- Create focused tax advisory section components only if needed
- Update `docs/project-changelog.md`

## Implementation Steps
1. Expand content config with deck-aligned help promises, overpayment reasons, engagement checkpoints, implementation tasks, roadmap stages, and responsibilities.
2. Update hero, process, roadmap, strategy, savings, and next-step copy.
3. Add page-like presentation sections for client experience and implementation accountability.
4. Validate Astro type-check/build.
5. Update plan/changelog status.

## Todo List
- [x] Expand page data.
- [x] Update and add sections.
- [x] Run validation.
- [x] Update docs and plan status.

## Success Criteria
- Page is longer and follows presentation sequence.
- Page builds without syntax/type errors.
- No private password behavior regression.

## Risk Assessment
- Source deck has OCR artifacts; use conservative paraphrase from readable content.
- Longer content can hurt mobile readability; use responsive grids and concise cards.

## Security Considerations
- Do not expose client-specific tax facts beyond the existing generic example.
- Keep route noindex and password gate.

## Next Steps
- After this phase, user can review `http://localhost:4321/tax-advisory`.
