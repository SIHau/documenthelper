#!/usr/bin/env bash
# 公文小幫手命令列的啟動器：找到專案根目錄、必要時安裝套件，再執行 cli/dh.ts。
# 稿件檔等相對路徑以「呼叫時所在的資料夾」為準。
# 若這個 skill 被複製到專案之外，請設定 DOCUMENTHELPER_DIR 指向公文小幫手專案根目錄。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${DOCUMENTHELPER_DIR:-$(cd "$HERE/../../../.." && pwd)}"

if [ ! -f "$ROOT/cli/dh.ts" ]; then
  echo "找不到公文小幫手專案（$ROOT）。請設定環境變數 DOCUMENTHELPER_DIR 指向專案根目錄。" >&2
  exit 2
fi

if [ ! -x "$ROOT/node_modules/.bin/tsx" ]; then
  echo "第一次使用，正在安裝套件（npm ci）…" >&2
  (cd "$ROOT" && npm ci --no-audit --no-fund >&2)
fi

exec "$ROOT/node_modules/.bin/tsx" "$ROOT/cli/dh.ts" "$@"
