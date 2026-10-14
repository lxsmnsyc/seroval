```js
import { serialize } from 'seroval';

const user = {
  name: 'Ada',
  joined: new Date('2026-10-14'),
  tags: new Set(['admin']),
};
user.self = user;

serialize(user);
```

```js
(h=>(h={name:"Ada",joined:new Date("2026-10-14T00:00:00.000Z"),tags:new Set(["admin"])},h.self=h,h))()
```
