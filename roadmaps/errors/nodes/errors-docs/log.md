# Log: errors-docs

- 2026-11-24: started on `docs/errors-docs` from origin/release/1.9.0 (9a11e7a6). No error pages exist yet; work not done.
- The site only reads `src/content/docs/*.md` (flat). Pages at `docs/errors/<code>.md` need `website/plugins/content.ts` (recursive read, nested slug, link rewrite) and `website/src/lib/docs.ts` (glob `**/*.md`). Both outside owned paths; kept minimal, recorded as deviations.
- Pages list in the sidebar under a new "Error codes" section, since the sidebar says every doc must be listed.
- Wrote 20 pages and the index; `docs.test.ts` checks pages, titles, class names, index links and sidebar slugs. Website build and typecheck pass; fast check passes.
- `website/src/lib/docs.ts` was already unformatted on the base; left as is.
