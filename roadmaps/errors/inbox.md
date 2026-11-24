# Inbox: errors

Ideas and bugs to triage. One entry each, with where it came from.

- 2026-11-24, from errors-path (#347): the dev message of a step wrapper around a seroval error reads "The value [object Undefined]..." for SRV001. The wrapper built in errors-base renders the catalog dev message from its own details instead of the inner error's. Unreleased (release/1.9.0 only), so it must be fixed before errors-release-1.9; needs a failing test first.
