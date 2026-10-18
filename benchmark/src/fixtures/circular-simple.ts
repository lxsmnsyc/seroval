interface Parent {
  name: string;
  child?: { parent: Parent };
}

const circularSimple = (): Parent => {
  const parent: Parent = {
    name: 'parent',
  };

  const child = { parent };

  parent.child = child;

  return parent;
};

export default circularSimple;
