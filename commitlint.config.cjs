/**
 * Commitlint rules enforce Conventional Commit messages for consistency and CI hooks.
 * Types ending with `~` are treated as provisional (AI authored) variants so the
 * repository can distinguish unverified commits from human-reviewed ones.
 */
const baseTypes = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    name: '@commitlint/config-conventional',
    parserOpts: {
      headerPattern: /^(\w+~?)(?:\(([^)]+)\))?!?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  rules: {
    'type-enum': [2, 'always', [...baseTypes, ...baseTypes.map((type) => `${type}~`)]],
    'body-max-line-length': [2, 'always', 100],
  },
};
