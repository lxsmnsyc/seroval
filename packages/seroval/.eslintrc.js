module.exports = {
  "root": true,
  "extends": [
    'lxsmnsyc/typescript',
  ],
  "parserOptions": {
    "project": "./tsconfig.eslint.json",
    "tsconfigRootDir": __dirname,
  },
  "rules": {
    "import/no-extraneous-dependencies": [
      "error", {
        "devDependencies": ["**/*.test.ts"]
      }
    ],
    "no-plusplus": "off",
    "no-continue": "off",
    "no-param-reassign": "off",
    "no-restricted-syntax": "off"
  }
};