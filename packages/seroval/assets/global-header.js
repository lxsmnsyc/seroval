/**
 * This file is used to represent the minified header script located at ./keys.ts
 * If anything, this code is the unminified, readable version of it.
 */

// Global references array. Global because we (ideally) want <script> elements to share it.
self._$ = self._$ || {
  // Promise constructor, used to construct deferred Promises
  P(success, failure, promise) {
    promise = new Promise(function (resolve, reject) {
      success = resolve;
      failure = reject;
    });
  
    promise.s = success;
    promise.f = failure;
  
    return promise;
  },
  // This unsets the custom properties of the Promise instance
  uP(promise) {
    delete promise.s;
    delete promise.f;
  },
  // Promise resolution
  Ps(promise, data) {
    promise.s(data);
    promise.value = data;
    this.uP(promise);
  },
  Pf(promise, data) {
    promise.f(data);
    this.uP(promise);
  },
  // Unset stream
  uS(stream) {
    delete stream.c;
  },
  Se(stream, data) {
    stream.c.enqueue(data);
  },
  St(stream, data) {
    stream.c.error(data);
    this.uS(stream);
  },
  Sc(stream) {
    stream.c.close();
    this.uS(stream);
  },
  // ReadableStream constructor
  S(stream, controller) {
    stream = new ReadableStream({
      start: function (c) {
        controller = c;
      }
    });
    stream.c = controller;
    return stream;
  },
};
