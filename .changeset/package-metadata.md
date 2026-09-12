---
'seroval': patch
'seroval-plugins': patch
---

Resolve known-value lookups with `hasOwnProperty.call` instead of `Object.hasOwn` so the build runs on the runtimes it targets, remove the no-op `typesVersions` from seroval, give seroval-plugins `main`, `module` and `types` fields plus a `typesVersions` entry that points at the emitted `web` declarations, and link the plugins package to the workspace copy of seroval.
