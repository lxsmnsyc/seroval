
import { serialize } from './dist/esm/development/index.mjs';

for (let i = 0; i < 1000; i++) {
  serialize({
    simple: true,
  })
}