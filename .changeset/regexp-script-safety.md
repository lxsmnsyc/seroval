---
'seroval': patch
---

Serialize a RegExp whose source contains `<` with the `RegExp` constructor, so a source such as `[</script>]` can no longer close the script element the output is embedded in.
