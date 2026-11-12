/* oxlint-disable typescript/explicit-function-return-type, typescript/no-unsafe-assignment, typescript/no-unsafe-type-assertion, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-explicit-any, typescript/require-await, typescript/no-unsafe-return, typescript/no-unsafe-argument, no-unreachable-loop -- the tests call names the types forbid and read the messages. */
import { describe, expect, it } from 'vitest';
import { createChannel, createEndpoint } from '../../src/index';
import { createPair, settle } from '../streaming/pair';

const CREDIT = 4;
const LEAVE = 5;

type Loose = { [name: string]: (...args: any[]) => any };

/** Starts a pair and records the stream messages the client sends. */
function startRecordedPair(functions: Loose) {
  const [a, b] = createPair();
  const sent: unknown[][] = [];
  const send = b.send.bind(b);
  b.send = (message) => {
    const type = (message as unknown[])[0];
    if (type === CREDIT || type === LEAVE) {
      sent.push(message as unknown[]);
    }
    send(message);
  };
  const server = createEndpoint(a);
  // A window of 2 gives credit back after every item.
  const client = createEndpoint(b, { window: 2 });
  server.serve(createChannel(functions));
  return { sent, root: client.connect<Loose>() };
}

describe('a received generator and the credit window', () => {
  it('sends no credit for the steps of a generator', async () => {
    const { sent, root } = startRecordedPair({
      *count() {
        yield 1;
        yield 2;
        yield 3;
      },
    });
    const seen: number[] = [];
    for await (const item of await root.run('count')) {
      seen.push(item);
    }
    await settle();
    expect(seen).toEqual([1, 2, 3]);
    expect(sent).toEqual([]);
  });

  it('does not leave the value when a generator is left early', async () => {
    const { sent, root } = startRecordedPair({
      *count() {
        yield 1;
        yield 2;
      },
    });
    for await (const item of await root.run('count')) {
      expect(item).toBe(1);
      break;
    }
    await settle();
    expect(sent).toEqual([]);
  });
});
