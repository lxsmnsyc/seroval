# seroval-plugins

## 1.6.0

### Minor Changes

- add Temporal support

### Patch Changes

- c9dbda4: Serialized constructors now survive name-preserving bundler transforms (e.g. esbuild `keepNames`, which some platforms apply to hosted code downstream of the app's own build): every nested function in a `toString()`-serialized constructor uses method shorthand, so no bundle-scoped name helper leaks into payloads evaluated in realms that never loaded the bundle.

## 1.5.6

## 1.5.5

### Patch Changes

- serialization fixes

## 1.5.4

## 1.5.3

## 1.5.2

## 1.5.1

## 1.5.0

### Minor Changes

- ac27f21: feat: restricted plugin format

## 1.4.2

## 1.4.1

### Patch Changes

- 3995cc1: security enhancements

## 1.4.0

### Minor Changes

- aae0bc1: Project restructure
