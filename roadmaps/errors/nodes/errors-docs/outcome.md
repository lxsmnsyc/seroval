# Outcome: errors-docs

## Built

- `website/src/content/docs/errors.md`: rewritten as the index. Covers the `SerovalError` fields (`name`, `code`, `step`, `cause`), how the three step wrappers take the code of the error they wrap, the production message format, and a table that links all 20 codes.
- `website/src/content/docs/errors/SRV001.md` to `SRV020.md`: one page per catalog code, served at `/docs/errors/<code>`. Each page has frontmatter `title: <code>` and `description: <catalog title>.`, then the error class, the step, the fields, and the sections "What it means", "Common causes" and "How to fix it".
- `website/src/content/sidebar.ts`: new section "Error codes" with the slugs `errors/SRV001` to `errors/SRV020`.
- `packages/seroval/test/errors/docs.test.ts`: fails when the pages and `ERROR_CODES` differ (missing or extra page), when a page title is not its code or its description is not the catalog title, when a page does not name the class from the catalog entry, when the index does not link a code, or when the sidebar does not list a code.

## Deviations

- `website/plugins/content.ts` and `website/src/lib/docs.ts` are outside the owned paths. The site only read `src/content/docs/*.md`, so `docs/errors/<code>` could not exist without them. Changes are small: the content plugin reads the docs folder recursively, a doc's slug is its path without `.md` (`errors/SRV008`), and relative links to nested docs resolve to `/docs/<path>`. `docs.ts` globs `../content/docs/**/*.md`.
- The pages document the frozen contract and catalog, not the classes in `core/errors.ts`. They name the three proposed classes (`SerovalStreamConsumedError`, `SerovalStreamOutputError`, `SerovalBase64LimitError`) as the catalog does.
- The `path` field is not documented. It belongs to the errors-path node, which a spike gates. Add it to the index fields table if errors-path ships.

## Stubs left

- None.

## Gotchas

- If errors-base names a new class differently from the catalog `name`, `docs.test.ts` fails until the page and the catalog agree. Update the page's `Error` line and the index table.
- A new catalog code needs a page at `website/src/content/docs/errors/<code>.md`, a row in the index table, and a slug in the sidebar. `docs.test.ts` checks all three.
- The "Step" line of each page follows the contract: SRV011, SRV012, SRV017 and SRV019 have none. If errors-base wraps SRV017 or sets a step on SRV019, update those pages.
- `docs.test.ts` reads website files by relative path from `packages/seroval/test/errors/`. Moving the website folder breaks it.

## Proposed learnings

- Every catalog code has a docs page at `website/src/content/docs/errors/<code>.md` | production messages link there | packages/seroval/src/core | yes (`docs.test.ts`)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1445 and 265 tests).
- `pnpm --filter seroval-website build`: pass. All 20 pages prerender to `website/dist/client/docs/errors/SRV0NN.html`. Every link on the pages points at a site page.
- `pnpm --filter seroval-website typecheck`: pass.
- `npx oxlint` on the four changed code files: clean. `npx oxfmt --check`: clean except `website/src/lib/docs.ts`, which was already unformatted on the base.
- `check_prose.py` on the 21 pages: no errors, no warnings.

## Size

- Estimated M, actual M.
