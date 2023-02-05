const data = { hello: 'world' };
const x = require('./packages/seroval').default(data);
const y = require('./dx-serializer')(data);
console.log(x.length, x);
console.log(y.length, y);
// console.log(renderServerValues('0-1-0', {
//   a: 1000,
//   b: '1000', 
//   c: undefined,
//   d: null,
//   e: [100,,,200],
//   f: { hello: 'world' },
//   ['---g']: 'test',
//   400: 'test',
//   h: true,
//   i: false,
//   j: new Set([1, 2, 3, 2, 1]),
//   k: new Map([[1, 2], [3, 4]]),
//   l: new Date(),
//   m: /[a-zA-Z0-9]/
// }));
