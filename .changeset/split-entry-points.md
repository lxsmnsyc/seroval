---
"seroval": minor
---

Add the `seroval/read`, `seroval/write` and `seroval/shared` entry points, so bundlers can put reading and writing in separate chunks.

- `seroval/read` exports `fromJSON`, `fromCrossJSON`, `createCrossDeserializer` and `deserialize`.
- `seroval/write` exports the serializers, `Serializer` and `getCrossReferenceHeader`.
- `seroval/shared` exports what both sides use, such as `createPlugin`, `Feature`, `Stream` and the errors. `seroval/read` and `seroval/write` also export it.
- `seroval` still exports everything. All entry points load the same chunks, so classes keep one identity.
