# seroval

> Stringify JS values

[![NPM](https://img.shields.io/npm/v/seroval.svg)](https://www.npmjs.com/package/seroval) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --save seroval
```

```bash
yarn add seroval
```

```bash
pnpm add seroval
```

## Usage

```js
import seroval from 'seroval';

const object = {
  number: [NaN, Infinity, -Infinity]
};
```

## Supports

- Exact values
  - `NaN`
  - `Infinity`
  - `-Infinity`
  - `-0`
- Primitives
  - `number`
  - `string`
  - `boolean`
  - `null`
  - `undefined`
  - `bigint`
- `Array` + holes
- `Object`
  - `RegExp`
  - `Date`
  - `Map`
  - `Set`
- Cyclic references (both self and mutual)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
