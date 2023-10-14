
import { serialize } from './dist/esm/development/index.mjs';

for (let i = 0; i < 10000; i++) {
  serialize({
    simple: true,
  })
}
