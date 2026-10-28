---
"seroval": patch
---

Republish the 1.7.2 changes through CI with npm provenance. 1.7.2 was published manually without an attestation, so pnpm's `trustPolicy: no-downgrade` refused to install it (#278). No code changes.
