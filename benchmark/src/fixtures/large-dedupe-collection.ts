import getData, { type Item } from './large-simple-collection';

const largeDedupeCollection = (): Item[] => {
  const result = getData().slice(0, 250);

  for (let i = 0; i < 250; i++) {
    const item = result[i];
    result.push(item, item, item);
  }

  return result;
};

export default largeDedupeCollection;
