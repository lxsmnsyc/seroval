import getData, { type Item } from './large-simple-collection';

interface CircularItem extends Item {
  selfA?: CircularItem;
  selfB?: CircularItem;
}

const largeCircularCollection = (): CircularItem[] => {
  const result: CircularItem[] = getData().slice(0, 250);

  for (let i = 0; i < 250; i++) {
    const item = result[i];
    // Assign selfB first to keep the key order of the chained assignment.
    item.selfB = item;
    item.selfA = item;
  }

  return result;
};

export default largeCircularCollection;
