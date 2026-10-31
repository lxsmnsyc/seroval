# Premortem: errors

It is six weeks from now and seroval 1.8 shipped late, or users complained. Why?

1. A framework matched on `err.message` or `err.name === 'Error'` and broke on the minor release. Mitigation: Q4, and the changeset names the change; errors-base keeps classes and constructor arguments.
2. Path tracking slowed serialization, and was found only after release. Mitigation: errors-path-spike gate, perf-pass in errors-path acceptance, errors-path has no milestone so the release does not wait for it.
3. Production builds grew because the catalog's messages were not stripped. Mitigation: the catalog's development messages must sit behind `import.meta.env.PROD`; add a bundle size check to errors-contract acceptance.
4. errors-plugins collided with `feat/plugin-validate`. Mitigation: Q3, errors-plugins waits for that branch.
5. Docs pages fell behind the catalog. Mitigation: errors-docs test fails when a code has no page.
