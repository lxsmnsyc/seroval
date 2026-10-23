import { describe, expect, it } from 'vitest';
import type { Plugin, SerovalJSON, SerovalNode } from '../src';
import {
  SerovalDeserializationError,
  SerovalMalformedNodeError,
  SerovalPluginValidationError,
  createPlugin,
  fromCrossJSON,
  fromJSON,
  toCrossJSON,
  toJSON,
  v,
} from '../src';

class Label {
  text: string;
  size: number;

  constructor(text: string, size: number) {
    this.text = text;
    this.size = size;
  }
}

type LabelNode = { text: SerovalNode; size: SerovalNode; extra: SerovalNode };

const deserialized: unknown[] = [];

// `extra` is written but never read by `deserialize`.
const LabelPlugin: Plugin<Label, LabelNode> = createPlugin<Label, LabelNode>({
  tag: 'test/Label',
  test: (value) => value instanceof Label,
  parse: {
    sync: (value, ctx) => ({
      text: ctx.parse(value.text),
      size: ctx.parse(value.size),
      extra: ctx.parse('unused'),
    }),
  },
  serialize: (node, ctx) => `new Label(${ctx.serialize(node.text)},${ctx.serialize(node.size)})`,
  validate: { text: v.string, size: v.number },
  deserialize(node, ctx) {
    const text = ctx.deserialize<string>(node.text);
    deserialized.push(text);
    return new Label(text, ctx.deserialize<number>(node.size));
  },
});

function encode(): SerovalJSON {
  return toJSON(new Label('a', 1), { plugins: [LabelPlugin] });
}

function setField(json: SerovalJSON, field: string, node: SerovalNode): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
  (json.t as unknown as { s: Record<string, SerovalNode> }).s[field] = node;
}

// Decoding wraps any error in `SerovalDeserializationError`, with the original
// error as `cause`.
function getCause(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SerovalDeserializationError);
    return error instanceof SerovalDeserializationError ? error.cause : undefined;
  }
  return undefined;
}

describe('plugin validate', () => {
  it('accepts valid fields', () => {
    const back = fromJSON<Label>(encode(), { plugins: [LabelPlugin] });
    expect(back).toEqual(new Label('a', 1));
    const cross = toCrossJSON(new Label('b', 2), { plugins: [LabelPlugin] });
    expect(fromCrossJSON<Label>(cross, { plugins: [LabelPlugin], refs: new Map() })).toEqual(
      new Label('b', 2),
    );
  });

  it('rejects a listed field before deserialize uses it', () => {
    const json = encode();
    setField(json, 'text', toJSON(42).t);
    deserialized.length = 0;
    const cause = getCause(() => fromJSON(json, { plugins: [LabelPlugin] }));
    expect(cause).toBeInstanceOf(SerovalPluginValidationError);
    expect(cause).toMatchObject({ tag: 'test/Label', field: 'text' });
    expect(deserialized).toEqual([]);
  });

  it('names the field that failed', () => {
    const json = encode();
    setField(json, 'size', toJSON('1').t);
    expect(getCause(() => fromJSON(json, { plugins: [LabelPlugin] }))).toMatchObject({
      field: 'size',
    });
  });

  it('does not decode fields that deserialize never reads', () => {
    const json = encode();
    // A plugin node with an unknown tag throws if it is ever decoded.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
    setField(json, 'extra', { t: 25, i: 50, c: 'test/missing', s: {} } as unknown as SerovalNode);
    expect(fromJSON<Label>(json, { plugins: [LabelPlugin] })).toEqual(new Label('a', 1));
  });

  it('rejects a plugin node whose fields are not an object', () => {
    const json = encode();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
    (json.t as unknown as { s: unknown }).s = 'text';
    expect(getCause(() => fromJSON(json, { plugins: [LabelPlugin] }))).toBeInstanceOf(
      SerovalMalformedNodeError,
    );
  });

  it('leaves plugins without validate unchanged', () => {
    const { validate: _, ...rest } = LabelPlugin;
    const plain = createPlugin<Label, LabelNode>(rest);
    const json = toJSON(new Label('a', 1), { plugins: [plain] });
    setField(json, 'size', toJSON('1').t);
    expect(fromJSON<Label>(json, { plugins: [plain] }).size).toBe('1');
  });
});
