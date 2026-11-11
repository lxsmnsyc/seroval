import { parentPort } from 'node:worker_threads';
// The worker runs in plain Node, which cannot load `../../src` without file
// extensions, so it imports the built package through its own name.
import { createChannel, createEndpoint } from '@seroval/rpc';
import { fromNodeWorker } from '@seroval/rpc/node';
import type { CallContext, RpcSignal } from '@seroval/rpc';
import type { SearchFunctions } from './api.ts';

/* oxlint-disable typescript/require-await */

const documents: string[] = [];
let lastScanCancelled = false;

function matchDocuments(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  for (const document of documents) {
    const text = document.toLowerCase();
    let matches = true;
    for (const word of words) {
      if (!text.includes(word)) {
        matches = false;
      }
    }
    if (matches) {
      result.push(document);
    }
  }
  return result;
}

async function waitForAbort(signal: RpcSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
    } else {
      signal.onAbort(() => {
        resolve();
      });
    }
  });
}

const functions: SearchFunctions = {
  async load(documentsToIndex, progress) {
    // Index one document at a time and tell the caller after each.
    let done = 0;
    for (const document of documentsToIndex) {
      documents.push(document);
      done++;
      progress?.notify('report', done, documentsToIndex.length);
    }
    return documents.length;
  },
  async search(query) {
    return matchDocuments(query);
  },
  async scan(this: CallContext) {
    // Wait for the caller to cancel, then record that the signal fired.
    lastScanCancelled = false;
    await waitForAbort(this.signal);
    lastScanCancelled = true;
    return [];
  },
  async scanWasCancelled() {
    return lastScanCancelled;
  },
  async *browse(query) {
    // Yield matches, and narrow the query with every word the caller sends.
    let current = query;
    let narrow: string | undefined;
    for (;;) {
      if (narrow) {
        current = `${current} ${narrow}`;
      }
      const matches = matchDocuments(current);
      if (matches.length === 0) {
        return;
      }
      narrow = yield matches[0];
    }
  },
  quit() {
    // Closing the root channel closes the endpoint; the port closes with it.
    this.channel.close();
  },
};

if (!parentPort) {
  throw new Error('This file runs as a worker.');
}

const root = createChannel(functions);
const endpoint = createEndpoint(fromNodeWorker(parentPort), { initiator: false });
endpoint.serve(root);
