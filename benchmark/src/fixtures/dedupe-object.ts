export default () => {
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
