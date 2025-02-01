import {
  createAsyncIteratorFactoryInstanceNode,
  createIteratorFactoryInstanceNode,
  createPluginNode,
  createStreamConstructorNode,
  createStreamNextNode,
  createStreamReturnNode,
  createStreamThrowNode,
  createStringNode,
} from '../../base-primitives';
import { NIL, SerovalNodeType } from '../../constants';
import { FALSE_NODE, TRUE_NODE } from '../../literals';
import { createSerovalNode } from '../../node';
import { SpecialReference } from '../../special-reference';
import type { Stream } from '../../stream';
import { createStreamFromAsyncIterable } from '../../stream';
import { serializeString } from '../../string';
import type {
  SerovalAbortSignalConstructorNode,
  SerovalAbortSignalSyncNode,
  SerovalNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
} from '../../types';
import { iteratorToSequence } from '../../utils/iterator-to-sequence';
import type { BaseSyncParserContextOptions } from './sync';
import BaseSyncParserContext from './sync';

export interface BaseStreamParserContextOptions
  extends BaseSyncParserContextOptions {
  onParse: (node: SerovalNode, initial: boolean) => void;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

export default abstract class BaseStreamParserContext extends BaseSyncParserContext {
  // Life
  private alive = true;

  // Amount of pending promises/streams
  private pending = 0;

  private onParseCallback: (node: SerovalNode, initial: boolean) => void;

  private onErrorCallback?: (error: unknown) => void;

  private onDoneCallback?: () => void;

  constructor(options: BaseStreamParserContextOptions) {
    super(options);
    this.onParseCallback = options.onParse;
    this.onErrorCallback = options.onError;
    this.onDoneCallback = options.onDone;
  }

  private initial = true;

  private buffer: SerovalNode[] = [];

  private onParseInternal(node: SerovalNode, initial: boolean): void {
    try {
      this.onParseCallback(node, initial);
    } catch (error) {
      this.onError(error);
    }
  }

  private flush(): void {
    for (let i = 0, len = this.buffer.length; i < len; i++) {
      this.onParseInternal(this.buffer[i], false);
    }
  }

  private onParse(node: SerovalNode): void {
    if (this.initial) {
      this.buffer.push(node);
    } else {
      this.onParseInternal(node, false);
    }
  }

  private onError(error: unknown): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    } else {
      throw error;
    }
  }

  private onDone(): void {
    if (this.onDoneCallback) {
      this.onDoneCallback();
    }
  }

  private pushPendingState(): void {
    this.pending++;
  }

  private popPendingState(): void {
    if (--this.pending <= 0) {
      this.onDone();
    }
  }

  protected parseProperties(
    properties: Record<string | symbol, unknown>,
  ): SerovalObjectRecordNode {
    const entries = Object.entries(properties);
    const keyNodes: SerovalObjectRecordKey[] = [];
    const valueNodes: SerovalNode[] = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
    }
    // Check special properties, symbols in this case
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createIteratorFactoryInstanceNode(
          this.parseIteratorFactory(),
          this.parse(
            iteratorToSequence(properties as unknown as Iterable<unknown>),
          ),
        ),
      );
    }
    symbol = Symbol.asyncIterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createAsyncIteratorFactoryInstanceNode(
          this.parseAsyncIteratorFactory(),
          this.parse(
            createStreamFromAsyncIterable(
              properties as unknown as AsyncIterable<unknown>,
            ),
          ),
        ),
      );
    }
    symbol = Symbol.toStringTag;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(createStringNode(properties[symbol] as string));
    }
    symbol = Symbol.isConcatSpreadable;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length,
    };
  }

  protected parsePromise(
    id: number,
    current: Promise<unknown>,
  ): SerovalPromiseConstructorNode {
    current.then(
      data => {
        const parsed = this.parseWithError(data);
        if (parsed) {
          this.onParse(
            createSerovalNode(
              SerovalNodeType.PromiseResolve,
              id,
              NIL,
              NIL,
              NIL,
              NIL,
              NIL,
              NIL,
              [
                this.parseSpecialReference(SpecialReference.PromiseResolve),
                parsed,
              ],
              NIL,
              NIL,
              NIL,
            ),
          );
        }
        this.popPendingState();
      },
      data => {
        if (this.alive) {
          const parsed = this.parseWithError(data);
          if (parsed) {
            this.onParse(
              createSerovalNode(
                SerovalNodeType.PromiseReject,
                id,
                NIL,
                NIL,
                NIL,
                NIL,
                NIL,
                NIL,
                [
                  this.parseSpecialReference(SpecialReference.PromiseReject),
                  parsed,
                ],
                NIL,
                NIL,
                NIL,
              ),
            );
          }
        }
        this.popPendingState();
      },
    );
    this.pushPendingState();
    return this.createPromiseConstructorNode(id);
  }

  protected parsePlugin(
    id: number,
    current: unknown,
  ): SerovalPluginNode | undefined {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.stream && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.stream(current, this, {
              id,
            }),
          );
        }
      }
    }
    return NIL;
  }

  protected parseStream(id: number, current: Stream<unknown>): SerovalNode {
    const result = createStreamConstructorNode(
      id,
      this.parseSpecialReference(SpecialReference.StreamConstructor),
      [],
    );
    this.pushPendingState();
    current.on({
      next: value => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamNextNode(id, parsed));
          }
        }
      },
      throw: value => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamThrowNode(id, parsed));
          }
        }
        this.popPendingState();
      },
      return: value => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamReturnNode(id, parsed));
          }
        }
        this.popPendingState();
      },
    });
    return result;
  }

  protected handleAbortSignal(id: number, current: AbortSignal): void {
    if (this.alive) {
      const parsed = this.parseWithError(current.reason);
      if (parsed) {
        this.onParse(
          createSerovalNode(
            SerovalNodeType.AbortSignalAbort,
            id,
            NIL,
            NIL,
            NIL,
            NIL,
            NIL,
            NIL,
            [
              this.parseSpecialReference(SpecialReference.AbortSignalAbort),
              parsed,
            ],
            NIL,
            NIL,
            NIL,
          ),
        );
      }
    }
    this.popPendingState();
  }

  protected parseAbortSignal(
    id: number,
    current: AbortSignal,
  ): SerovalAbortSignalConstructorNode | SerovalAbortSignalSyncNode {
    if (current.aborted) {
      return this.parseAbortSignalSync(id, current);
    }

    this.pushPendingState();

    current.addEventListener(
      'abort',
      this.handleAbortSignal.bind(this, id, current),
      { once: true },
    );

    return this.createAbortSignalConstructorNode(id);
  }

  private parseWithError<T>(current: T): SerovalNode | undefined {
    try {
      return this.parse(current);
    } catch (err) {
      this.onError(err);
      return NIL;
    }
  }

  /**
   * @private
   */
  start<T>(current: T): void {
    const parsed = this.parseWithError(current);
    if (parsed) {
      this.onParseInternal(parsed, true);
      this.initial = false;
      this.flush();

      // Check if there's any pending pushes
      if (this.pending <= 0) {
        this.destroy();
      }
    }
  }

  /**
   * @private
   */
  destroy(): void {
    if (this.alive) {
      this.onDone();
      this.alive = false;
    }
  }

  isAlive(): boolean {
    return this.alive;
  }
}
