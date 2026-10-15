interface Child {
  name: string;
}

interface Parent {
  name: string;
  child: Child;
}

const dedupeObject = (): { mother: Parent; father: Parent } => {
  const child = {
    name: 'Henry',
  };

  const mother = {
    name: 'Jane',
    child,
  };

  const father = {
    name: 'Frank',
    child,
  };

  return {
    mother,
    father,
  };
};

export default dedupeObject;
