interface Parent {
  name: string;
  age: number;
  children: Child[];
}

interface Child {
  name: string;
  age: number;
  father: Parent;
  mother: Parent;
}

const circularDedupe = (): { mother: Parent; father: Parent } => {
  const mother: Parent = {
    name: 'Jane',
    age: 30,
    children: [],
  };

  const father: Parent = {
    name: 'Frank',
    age: 32,
    children: [],
  };

  const child1: Child = {
    name: 'Sue',
    age: 5,
    mother, // circular
    father, // circular
  };

  const child2: Child = {
    name: 'Henry',
    age: 10,
    mother, // circular
    father, // circular
  };

  mother.children.push(child1, child2);
  father.children.push(child1 /* duplicate */, child2 /* duplicate */);

  return {
    mother,
    father,
  };
};

export default circularDedupe;
