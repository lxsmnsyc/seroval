/** The channel or the endpoint closed before the call finished. */
export class RpcClosedError extends Error {
  constructor(message = 'The channel is closed.') {
    super(message);
    this.name = 'RpcClosedError';
  }
}

/** The transport failed, or the other end sent something rpc cannot read. */
export class RpcTransportError extends Error {
  constructor(message = 'The transport failed.') {
    super(message);
    this.name = 'RpcTransportError';
  }
}

/**
 * The called function threw on the other end. Only `name` and `message` cross
 * the wire, never a stack or a cause. `remoteName` is the remote `name`.
 */
export class RpcRemoteError extends Error {
  readonly remoteName: string;

  constructor(remoteName: string, message: string) {
    super(message);
    this.name = 'RpcRemoteError';
    this.remoteName = remoteName;
  }
}
