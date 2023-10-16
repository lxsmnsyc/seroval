/* eslint-disable @typescript-eslint/ban-types */
const { getPrototypeOf } = Object;

export function getConstructor(value: unknown): Function {
  return (getPrototypeOf(value) as Object).constructor;
}
