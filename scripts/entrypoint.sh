#!/bin/bash
# Git認証ファイルを環境変数から作成
if [ -n "$GITHUB_USERNAME" ] && [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
    echo "https://${GITHUB_USERNAME}:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com" > /root/.git-credentials
    chmod 600 /root/.git-credentials
    git config --global credential.helper store
fi

# 元のコマンドを実行
exec "$@"
