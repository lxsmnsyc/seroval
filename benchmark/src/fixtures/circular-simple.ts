export default () => {
  const parent = {
    name: 'parent',
  } as { name: string; child: typeof child };

  const child = { parent };

  parent.child = child;

  return parent;
};
