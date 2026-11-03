# Checklist: errors

- Data and migrations: N/A.
- Compatibility: exported classes and constructor arguments stay; `instanceof` stays (GOAL constraints). `name` and message text change: Q4, minor release with a note.
- Auth and permissions: N/A.
- Failure modes: this roadmap is about them. Step wrappers keep the inner code (error-model).
- Concurrency: N/A.
- Limits: path arrays on very deep values: errors-path caps the path length at the depth limit.
- Security: production messages carry no values (GOAL constraints, errors-base test).
- Observability: codes make errors countable in logs. This is the observability change.
- Performance: errors-path-spike measures, errors-path checks with perf-pass; success path must not slow down.
- Testing: model, base, malformed, path and docs tests under `packages/seroval/test/errors/`.
- Local files: N/A.
- Developer experience: catalog, development messages with reasons and paths, docs pages (errors-malformed-detail, errors-path, errors-docs).
- Rollout: minor release; nothing to turn off.
- Cleanup: deprecated export removal parked for 2.0 (errors-remove-deprecated).
- Coverage: N/A, not imported from a document; built from the review of errors.ts in this session.
- Dependencies: none.
