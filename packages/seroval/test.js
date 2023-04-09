
import { serialize } from 'seroval';

console.dir([(serialize({
  ['<script></script>']: '<script></script>'
}))], {
  depth: null
});