async function readableStreamToSequence(stream) {
  const values = [];
  let throwsAt = -1;
  let doneAt = -1;

  const iterator = stream.getReader();

  while (true) {
    try {
      const value = await iterator.read();
      values.push(value.value);
      if (value.done) {
        doneAt = values.length - 1;
        break;
      }
    } catch (error) {
      throwsAt = values.length;
      values.push(error);
    }
  }

  return {
    v: values,
    t: throwsAt,
    d: doneAt,
  };
}

console.log(await readableStreamToSequence(
  new ReadableStream({
    start(controller) {
      controller.error('foo');
    }
  })
))