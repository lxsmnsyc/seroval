// Compile-time checks of the draft types; `tsc -p packages/rpc` runs them.
import { createChannel, createEndpoint } from '../../src/index';
import type { CallContext, Channel, Port } from '../../src/index';

interface AsInterface {
  search(query: string): Promise<string[]>;
}

export function checkThisContext(): void {
  // `this` is CallContext without an annotation.
  createChannel({
    scan(query: string) {
      this.channel.close();
      return [query, this.signal.aborted];
    },
  });
  // An annotation on the method also fits.
  createChannel({
    scan(this: CallContext, query: string) {
      return [query, this.signal.aborted];
    },
  });
  // @ts-expect-error a channel holds only functions
  createChannel({ value: 1 });
}

export function checkInterfaces(port: Port, owned: AsInterface): Promise<unknown>[] {
  // An interface fits, both for the owner and the holder.
  const local: Channel<AsInterface> = createChannel(owned);
  const endpoint = createEndpoint(port, { initiator: true });
  endpoint.serve(local);
  const remote = endpoint.connect<AsInterface>();
  return [
    remote.run('search', 'x'),
    // @ts-expect-error no function with that name
    remote.run('serch', 'x'),
    // @ts-expect-error the argument has the wrong type
    remote.run('search', 1),
  ];
}
