/**
 * This file is used to represent the minified header script located at ./keys.ts
 * If anything, this code is the unminified, readable version of it.
 */

// Global references array. Global because we (ideally) want <script> elements to share it.
$R = [];

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
  delete stream.q;
  delete stream.e;
  delete stream.c;
}

function $iS(streamController, callSignal) {
  switch (callSignal[0]) {
    case 0: return streamController.enqueue(callSignal[1]);
    case 1: return streamController.error(callSignal[1]);
    case 2: return streamController.close();
  }
}


// Emits the signal and records it
function $wS(buffer, listeners, callType, data, i, len) {
  buffer.push([callType, data]);
  for (i = 0, len = listeners.length; i < len; i++) {
    listeners[i]([callType, data]);
  }
}

function $fS(buffer, controller, i, len) {
  for (i = 0, len = buffer.length; i < len; i++) {
    $iS(controller, buffer[i]);
  }
}


// ReadableStream constructor. This is a special kind of stream because
// it's basically a Transformer stream with a buffer, so that it records
// past values, emits the recorded values on "subscription", and then
// continues recording it.
function $S(buffer, listeners, stream) {
  // Buffer contains tuples of stream calls where the tuple is [callType, data]
  // callType is either 0 (enqueue), 1 (error) or 2 (close)
  buffer = [];

  // An array of listeners
  listeners = [];

  stream = new ReadableStream({
    start: function (controller) {
      $fS(buffer, controller);
      listeners.push(function (callSignal) {
        $iS(controller, callSignal);
      });
    }
  });

  stream.q = function (data) {
    $wS(buffer, listeners, 0, data);
  };
  stream.e = function (data) {
    $wS(buffer, 1, data);
    $uS(stream);
  };
  stream.c = function () {
    $wS(buffer, listeners, 2);
    $uS(stream);
  };

  return stream;
}

function $Sq(referenceID, data) {
  $R[referenceID].q(data);
}
function $Se(referenceID, data) {
  $R[referenceID].e(data);
}
function $Sc(referenceID) {
  $R[referenceID].c();
}
