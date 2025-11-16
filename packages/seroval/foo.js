import { fromJSON, toJSONAsync } from "./dist/esm/development/index.mjs";

const p = Promise.resolve('hello');

const json = await toJSONAsync([p, p]);

console.log(json);

const reconst = fromJSON(json);

console.log(reconst, reconst[0] === reconst[1]);