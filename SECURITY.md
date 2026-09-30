# Security Policy

## Supported Versions

seroval's versioning is linear, so only the latest version is supported.

## Reporting a Vulnerability

Report vulnerabilities by [submitting a draft security advisory](https://github.com/lxsmnsyc/seroval/security/advisories/new). Do not open a public issue.

Split the report in two:

1. The advisory itself holds only the summary. Describe the affected API, the impact, and the affected versions. Leave out proof-of-concept code, payloads and exploit steps.
2. Post the sensitive details as a follow-up comment on the advisory. This includes:
   - the details of the problem
   - a minimal reproduction
   - a proposed solution, if you have one

The advisory text becomes public when the advisory is published. Comments stay private. Keeping the details in a comment means the published advisory does not include a working exploit.

## What happens next

1. The maintainer reviews the report and either accepts it or closes it with an explanation.
2. An accepted advisory stays in draft while the fix is prepared and released.
3. After the fix is released, the advisory stays in draft for about a month. This gives users time to upgrade before the details are public.
4. The advisory is then published with the affected and patched versions.
