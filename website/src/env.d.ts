declare module '*.md' {
  import type { Component } from 'solid-js';

  export const doc: {
    title: string;
    html: string;
    headings: { depth: number; text: string; id: string }[];
  };
  const Page: Component;
  export default Page;
}
