module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 日本語のコミットメッセージに対応
    'subject-case': [0, 'never'],
    'body-case': [0, 'never'],
    // 長いコミットメッセージを許可
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    // 日本語文字を許可
    'subject-full-stop': [0, 'never'],
    // conventional commits のタイプを拡張
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert'
      ]
    ]
  }
};