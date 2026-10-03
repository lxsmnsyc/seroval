# `seroval-plugins`

> Plugins for [`seroval`](https://github.com/lxsmnsyc/seroval)

[![NPM](https://img.shields.io/npm/v/seroval-plugins.svg)](https://www.npmjs.com/package/seroval-plugins) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

`seroval` handles most built-in JavaScript types on its own. This package adds
support for types it does not cover natively — chiefly Web platform APIs — as
opt-in plugins you pass through the `plugins` option. Each plugin participates in
all of `seroval`'s serialization modes: string, JSON tree, streaming, and
binary.

## Install

```bash
npm install --save seroval-plugins
```

```bash
yarn add seroval-plugins
```

```bash
pnpm add seroval-plugins
```

## Usage

Import the plugins you need from `seroval-plugins/web` and pass them to any
`seroval` serializer/deserializer.

```js
import { serializeAsync, deserialize } from 'seroval';
import { BlobPlugin, HeadersPlugin } from 'seroval-plugins/web';

const result = await serializeAsync(new Blob(['hello world']), {
  plugins: [BlobPlugin],
});

const value = deserialize(result); // Blob
```

Some plugins compose others automatically — for example `RequestPlugin` pulls in
`HeadersPlugin` and `ReadableStreamPlugin` — so you only need to register the
top-level type you are serializing.

## Available plugins

### `seroval-plugins/web`

- [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
- [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)
- [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException)
- [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event)
- [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
- [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
- [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
- [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
- [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
- [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)

## Writing your own

Build a plugin for any type with `createPlugin` from `seroval`. See the
[plugins source](https://github.com/lxsmnsyc/seroval/tree/main/packages/plugins/web)
for complete examples.

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
