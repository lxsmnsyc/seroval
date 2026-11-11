---
'seroval': minor
---

Typed array nodes in JSON and JavaScript output name their constructor with a numeric tag in `s` instead of a name in `c`. JSON written by an earlier version that contains a typed array cannot be decoded by this version, and the reverse.
