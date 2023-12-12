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
    "prefer-template": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "prefer-object-spread": "off",
    "class-methods-use-this": "off",
    "@typescript-eslint/no-explicit-any": "off"
  }
};