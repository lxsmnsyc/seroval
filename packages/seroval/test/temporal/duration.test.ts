import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from "../../src";
import { evaluateCross, streamCross, streamCrossJSON } from "../utils/cross";
import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";

const EXAMPLE = Temporal.Duration.from("P1Y2M3DT4H5M6S");

describe("Temporal.Duration", () => {
  describe("serialize", () => {
    it("supports Temporal.Duration", () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("serializeAsync", () => {
    it("supports Temporal.Duration", async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("toJSON", () => {
    it("supports Temporal.Duration", () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("toJSONAsync", () => {
    it("supports Temporal.Duration", async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("crossSerialize", () => {
    it("supports Temporal.Duration", () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe("scoped", () => {
      it("supports Temporal.Duration", () => {
        const result = crossSerialize(EXAMPLE, {
          scopeId: "example",
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe("crossSerializeAsync", () => {
    it("supports Temporal.Duration", async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe("scoped", () => {
      it("supports Temporal.Duration", async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: "example",
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, "example");
        expect(back).toBeInstanceOf(Temporal.Duration);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe("crossSerializeStream", () => {
    it("supports Temporal.Duration", async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe("scoped", () => {
      it("supports Temporal.Duration", async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: "example",
        });
        expect(back).toBeInstanceOf(Temporal.Duration);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe("toCrossJSON", () => {
    it("supports Temporal.Duration", () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("toCrossJSONAsync", () => {
    it("supports Temporal.Duration", async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe("toCrossJSONStream", () => {
    it("supports Temporal.Duration", async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Temporal.Duration);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
});
