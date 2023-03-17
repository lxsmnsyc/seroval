
import { fromJSON, toJSON } from 'seroval';

console.log([fromJSON(toJSON('"hello"'))]);
console.log([fromJSON(toJSON('<script></script>'))]);