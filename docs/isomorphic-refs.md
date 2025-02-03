# Isomorphic references

There are values that has no way to be serializable at all, i.e. functions, but usually in an isomorphic code, functions can exist on both client and server-side. What if we can serialize these functions in such a way we can refer to their counterparts?

`seroval` has `createReference` that you can use to map user-defined strings to their references.

```js
import { createReference } from 'seroval';

const thisIsAnIsomorphicFunction = createReference(
  // This is (ideally) a unique identifier
  // that is used to map the serialized value
  // to its actual reference (and vice versa)
  'my-function',
  () => {
    // Ideally this function should exist on both
    // server and client, but we want to add the ability
    // to serialize and deserialize this reference on
    // both sides
  }
);

// we can now serialize this
const serialized = toJSON(thisIsAnIsomorphicFunction); // or any of the serializer
thisIsAnIsomorphicFunction === fromJSON(serialized); // true
```

> [!NOTE]
> It can only accept objects, functions and symbols and it doesn't actually
> serialize their values but only the string you used to identify the reference
