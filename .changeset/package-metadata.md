---
'seroval': minor
'seroval-plugins': minor
---

Raise the supported Node.js floor from `>=10` to `>=20` in `engines`, remove the no-op `typesVersions` from seroval, give seroval-plugins `main`, `module` and `types` fields plus a `typesVersions` entry that points at the emitted `web` declarations, and link the plugins package to the workspace copy of seroval.
