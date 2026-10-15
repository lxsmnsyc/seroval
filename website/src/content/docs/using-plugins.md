---
title: Using plugins
description: Add support for more types with plugins, and use the web plugins from seroval-plugins.
---

Plugins teach seroval new types. Pass them in the `plugins` option of any function, on both the sending and the receiving side.

```js
import { serializeAsync } from 'seroval';
import { BlobPlugin } from 'seroval-plugins/web';

const blob = new Blob(['Hello'], { type: 'text/plain' });

await serializeAsync(blob, { plugins: [BlobPlugin] });
```

Every function takes `plugins`, including `fromJSON`, `fromCrossJSON`, `createCrossDeserializer` and `Serializer`. The receiver needs a plugin with the same tag as the one the sender used, or decoding throws `SerovalMissingPluginError`.

When several plugins accept the same value, the first one in the list wins. A plugin can depend on other plugins, which are then added for you.

## seroval-plugins

The `seroval-plugins` package has plugins for common web platform types.

```bash
npm install seroval-plugins
```

```js
import {
  FormDataPlugin,
  HeadersPlugin,
  RequestPlugin,
  URLPlugin,
} from 'seroval-plugins/web';
```

Some types can only be read asynchronously. A `Blob`'s bytes, for example, are only available through a promise. Those plugins work only with the async and streaming functions.

| Plugin | Type | Sync | Async | Streaming |
| --- | --- | --- | --- | --- |
| `URLPlugin` | [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) | ✅ | ✅ | ✅ |
| `URLSearchParamsPlugin` | [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | ✅ | ✅ | ✅ |
| `HeadersPlugin` | [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) | ✅ | ✅ | ✅ |
| `FormDataPlugin` | [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | ✅ [^formdata] | ✅ | ✅ [^formdata] |
| `BlobPlugin` | [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | ❌ | ✅ | ❌ [^blob] |
| `FilePlugin` | [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) | ❌ | ✅ | ❌ [^blob] |
| `ReadableStreamPlugin` | [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) | ❌ | ✅ | ✅ |
| `RequestPlugin` | [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) | ❌ | ✅ | ✅ |
| `ResponsePlugin` | [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) | ❌ | ✅ | ✅ |
| `EventPlugin` | [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event) | ✅ | ✅ | ✅ |
| `CustomEventPlugin` | [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) | ✅ | ✅ | ✅ |
| `DOMExceptionPlugin` | [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException) | ✅ | ✅ | ✅ |
| `ImageDataPlugin` | [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData) | ✅ | ✅ | ✅ |
| `AbortSignalPlugin` | [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) | ✅ | ✅ | ✅ |

[^formdata]: Only when the `FormData` contains no `Blob` or `File` entries.
[^blob]: A `Blob` is built synchronously but its bytes can only be read asynchronously, so a stream cannot represent it as the same type.

To use every web plugin at once:

```js
import * as web from 'seroval-plugins/web';

const plugins = Object.values(web);
```

## Writing your own

See [Writing plugins](./writing-plugins.md). If your plugin decodes data from a client, also read [Plugin security](./plugin-security.md).
