import { serialize } from './dist/esm/development/index.mjs';

function example() {
  return new Set([
    {
      id: 1,
      first_name: 'Jimmy',
      last_name: 'Hansen',
      email: 'jhansen0@skyrock.com',
      gender: 'Male',
      ip_address: '166.6.70.130',
    },
    {
      id: 1,
      first_name: 'Judy',
      last_name: 'Cook',
      email: 'jcook0@themeforest.net',
      gender: 'Female',
      ip_address: '171.246.40.83',
    },
    {
      id: 2,
      first_name: 'Anne',
      last_name: 'Thomas',
      email: 'athomas1@usda.gov',
      gender: 'Female',
      ip_address: '158.159.200.150',
    },
  ]);
}

for (let i = 0; i < 10000; i++) {
  serialize(example());
}
