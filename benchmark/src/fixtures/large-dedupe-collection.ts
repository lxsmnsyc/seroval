import getData from './large-simple-collection';

export default () => {
  const result = getData().slice(0, 250);

  for (let i = 0; i < 250; i++) {
    const item = result[i];
    result.push(item, item, item);
  }

  return result;
};
