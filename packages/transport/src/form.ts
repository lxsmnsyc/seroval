import type { FromJSONOptions, SerovalJSON, SerovalNode } from 'seroval/read';
import { createPlugin, fromJSON } from 'seroval/read';
import type { ToJSONAsyncOptions } from 'seroval/write';
import { toJSONAsync } from 'seroval/write';
import { SerovalTransportError } from './message';

/**
 * The form field that holds the value, as seroval JSON. Each file and blob in
 * the value goes in a field of its own, named `FILE_FIELD` and its index, and
 * the JSON holds only the index.
 */
export const VALUE_FIELD = 'seroval';
export const FILE_FIELD = 'seroval:';

const BLOB_TAG = 'seroval-transport/form/Blob';
const FORM_DATA_TAG = 'seroval-transport/form/FormData';

// A blob node holds the field index and the type. A file node also holds the
// name and `lastModified`, which a multipart part does not keep.
type BlobNode = {
  i: SerovalNode;
  t: SerovalNode;
  n?: SerovalNode;
  l?: SerovalNode;
};

type FormDataNode = {
  e: SerovalNode;
};

/**
 * True for a file or a blob. One from another realm, such as an iframe, is
 * not an instance of this realm's `Blob`, so its shape tells instead.
 */
function isBlob(value: unknown): value is Blob {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true;
  }
  const blob = value as Partial<Blob> | null;
  return (
    typeof blob === 'object' &&
    blob !== null &&
    typeof blob.size === 'number' &&
    typeof blob.type === 'string' &&
    typeof blob.arrayBuffer === 'function' &&
    typeof blob.slice === 'function'
  );
}

function isFile(value: Blob): value is File {
  const file = value as Partial<File>;
  return typeof file.name === 'string' && typeof file.lastModified === 'number';
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function malformed(): SerovalTransportError {
  return new SerovalTransportError('The form data is malformed.');
}

function refuseParse(): never {
  throw new SerovalTransportError('Only `toFormData` can encode a file or a blob.');
}

function refuseSerialize(): never {
  throw new SerovalTransportError('A file or a blob can only be sent with `toFormData`.');
}

/**
 * Takes each file and blob of the value into `files`, and writes its index.
 * `form` is the form data of the reader, whose fields the indexes read.
 */
function createBlobPlugin(files: Blob[] | undefined, form: FormData | undefined) {
  return createPlugin<Blob, BlobNode>({
    tag: BLOB_TAG,
    skipPlainObjects: true,
    test: isBlob,
    parse: {
      async async(value, ctx) {
        if (!files) {
          refuseParse();
        }
        const index = files.push(value) - 1;
        if (isFile(value)) {
          return {
            i: await ctx.parse(index),
            t: await ctx.parse(value.type),
            n: await ctx.parse(value.name),
            l: await ctx.parse(value.lastModified),
          };
        }
        return {
          i: await ctx.parse(index),
          t: await ctx.parse(value.type),
        };
      },
    },
    serialize: refuseSerialize,
    deserialize(node, ctx) {
      if (!form) {
        throw malformed();
      }
      const index = ctx.deserialize(node.i);
      const type = ctx.deserialize(node.t);
      if (
        typeof index !== 'number' ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        typeof type !== 'string'
      ) {
        throw malformed();
      }
      const part = form.get(FILE_FIELD + index);
      if (!(part instanceof Blob)) {
        throw malformed();
      }
      // A part is always a file, with a default name and type when the value
      // was a blob, so the value is rebuilt from the node. The new blob refers
      // to the bytes of the part instead of copying them.
      if (node.n === undefined) {
        return new Blob([part], { type });
      }
      const name = ctx.deserialize(node.n);
      const lastModified = node.l === undefined ? undefined : ctx.deserialize(node.l);
      if (typeof name !== 'string' || typeof lastModified !== 'number') {
        throw malformed();
      }
      return new File([part], name, { type, lastModified });
    },
  });
}

/** Sends form data as its entries, so its files go through the blob plugin. */
const FormDataPlugin = /* @__PURE__ */ createPlugin<FormData, FormDataNode>({
  tag: FORM_DATA_TAG,
  skipPlainObjects: true,
  test: isFormData,
  parse: {
    async async(value, ctx) {
      const entries: [string, FormDataEntryValue][] = [];
      for (const entry of value.entries()) {
        entries.push(entry);
      }
      return { e: await ctx.parse(entries) };
    },
  },
  serialize: refuseSerialize,
  deserialize(node, ctx) {
    const entries = ctx.deserialize(node.e);
    if (!Array.isArray(entries)) {
      throw malformed();
    }
    const result = new FormData();
    for (const entry of entries) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string' ||
        !(typeof entry[1] === 'string' || entry[1] instanceof Blob)
      ) {
        throw malformed();
      }
      result.append(entry[0], entry[1]);
    }
    return result;
  },
});

export interface ToFormDataOptions extends ToJSONAsyncOptions {}

/**
 * Encodes `value` as form data. Files and blobs, anywhere in the value and in
 * form data in it, go as parts of their own instead of base64 in the JSON, so
 * a browser reads each one as it sends the request. Promises in the value are
 * awaited. Read it with `fromFormData`.
 */
export async function toFormData(value: unknown, options: ToFormDataOptions = {}): Promise<FormData> {
  // The plugins of this module go first, so a blob plugin of the caller,
  // such as the one of seroval-plugins, does not take the files.
  const files: Blob[] = [];
  const json = await toJSONAsync(value, {
    ...options,
    plugins: [createBlobPlugin(files, undefined), FormDataPlugin, ...(options.plugins ?? [])],
  });
  const form = new FormData();
  form.set(VALUE_FIELD, JSON.stringify(json));

  // Form data only takes blobs of its own realm, so copy the others.
  const copies: Promise<Blob>[] = [];
  for (const file of files) {
    copies.push(
      file instanceof Blob
        ? Promise.resolve(file)
        : (file as Blob).arrayBuffer().then((data) => new Blob([data], { type: (file as Blob).type })),
    );
  }
  const blobs = await Promise.all(copies);
  for (let i = 0, len = blobs.length; i < len; i++) {
    const file = files[i];
    form.set(FILE_FIELD + i, blobs[i], isFile(file) ? file.name : 'blob');
  }
  return form;
}

export interface FromFormDataOptions extends FromJSONOptions {}

/**
 * Decodes the value that `toFormData` encoded in `form`. It validates the
 * input and runs no code, as `fromJSON` does, so `form` can come from an
 * untrusted client. Throws a `SerovalTransportError` when the value field
 * is missing or is not JSON, and the errors of `fromJSON` on a malformed
 * value, such as an index whose part is missing.
 */
export function fromFormData<T>(form: FormData, options: FromFormDataOptions = {}): T {
  const field = form.get(VALUE_FIELD);
  if (typeof field !== 'string') {
    throw malformed();
  }
  let json: unknown;
  try {
    json = JSON.parse(field);
  } catch {
    throw malformed();
  }
  if (typeof json !== 'object' || json === null) {
    throw malformed();
  }
  return fromJSON<T>(json as SerovalJSON, {
    ...options,
    plugins: [createBlobPlugin(undefined, form), FormDataPlugin, ...(options.plugins ?? [])],
  });
}

export interface ToFormRequestOptions extends ToFormDataOptions {
  /** The options of the request. The method defaults to `POST`. */
  init?: Omit<RequestInit, 'body'>;
}

/**
 * Creates a `Request` whose body is `value` as form data, as `toFormData`
 * encodes it. Leave out the `Content-Type` header: the request sets it with
 * the boundary of the parts. Read it with `fromFormRequest`.
 */
export async function toFormRequest(
  input: RequestInfo | URL,
  value: unknown,
  options: ToFormRequestOptions = {},
): Promise<Request> {
  const { init, ...formOptions } = options;
  return new Request(input, {
    method: 'POST',
    ...init,
    body: await toFormData(value, formOptions),
  });
}

/**
 * Decodes the body of a request that `toFormRequest` created. `request.formData()`
 * reads the whole body before it decodes, so limit the size of the body in
 * the server first. Rejects with a `SerovalTransportError` when the body is
 * not form data.
 */
export async function fromFormRequest<T>(
  request: Request,
  options: FromFormDataOptions = {},
): Promise<T> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new SerovalTransportError('The request body is not form data.');
  }
  return fromFormData<T>(form, options);
}
