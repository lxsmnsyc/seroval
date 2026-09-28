---
'seroval': patch
---

Preserve stream event order during async parsing and wait for earlier chunks before completing. Live writes are accepted after their parsed event is placed.

Stop sources on parse or output failure, forward cancellation reasons, and release owned callbacks and records. Keep the original error when cleanup also fails, reject cleanup failures after otherwise successful parsing, and retain existing streaming plugin lifecycle hooks.

Keep incidental primitive callback returns synchronous. Only objects and functions are inspected for thenables, and the callable `then` is invoked without reading its `call` property.
