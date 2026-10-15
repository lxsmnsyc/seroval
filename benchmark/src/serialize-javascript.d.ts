// serialize-javascript 7 ships without type declarations.
declare module 'serialize-javascript' {
  interface SerializeOptions {
    space?: string | number;
    isJSON?: boolean;
    unsafe?: boolean;
    ignoreFunction?: boolean;
  }

  export default function serialize(
    input: unknown,
    options?: SerializeOptions | string | number,
  ): string;
}
