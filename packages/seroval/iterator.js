function* test() {

}

function inheritance(value) {
  const p = Object.getPrototypeOf(value);
  if (p) {
    console.log(p);
    console.log(Object.getOwnPropertyDescriptors(p));
    inheritance(p);
  }
}

inheritance(test());
inheritance(new ReadableStream());