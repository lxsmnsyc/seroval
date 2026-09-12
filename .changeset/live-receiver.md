---
'seroval': minor
---

Streams serialized from a live stream in streaming mode are rebuilt with a live receiver: it keeps history only until its first listener subscribes, then forwards each value without retaining it and refuses a second listener. Replay streams and existing serialized data are unchanged, and readers that ignore the marker build a replay receiver.
