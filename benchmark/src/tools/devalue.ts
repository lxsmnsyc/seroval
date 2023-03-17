import { uneval } from 'devalue';

export const name = 'devalue';

export function toString(data: unknown) {
  return uneval(data);
}

export function fromString(str: string) {
  return (0, eval)(`(${str})`);
}
