/**
 * This file is used to represent the minified header script located at ./keys.ts
 * If anything, this code is the unminified, readable version of it.
 */

// Global references array. Global because we (ideally) want <script> elements to share it.
var $R = [];

// Promise constructor, used to construct deferred Promises
function $P(success, failure, promise) {
  promise = new Promise(function (resolve, reject) {
    success = resolve;
    failure = reject;
  });

  promise.s = success;
  promise.f = failure;

  return promise;
}

// This unsets the custom properties of the Promise instance
function $uP(promise) {
  delete promise.s;
  delete promise.f;
}

function $Ps(referenceID, data) {
  $R[referenceID].s(data);
}

function $Pf(referenceID, data) {
  $R[referenceID].f(data);
}

// Unset stream
function $uS(stream) {
  delete stream.c;
}

function $Se(referenceID, type, data, stream, controller) {
  stream = $R[referenceID];
  controller = stream.c;
  switch (type) {
    case 0: return controller.enqueue(data);
    case 1:
      $uS(stream);
      return controller.error(data);
    case 2:
      $uS(stream);
      return controller.close();
  }
}

// ReadableStream constructor
function $S(stream, controller) {
  stream = new ReadableStream({
    start: function (c) {
      controller = c;
    }
  });
  stream.c = controller;

  return stream;
}
