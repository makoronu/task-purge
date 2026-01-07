# Task Purge

Monday.comの緊急・高優先度タスク（当日期限）を監視し、未完了なら15分間隔で音声リマインドするPWAアプリ

## 工程プロンプト

| 作業 | ファイル |
|------|---------|
| 開発 | `.claude/prompts/2_dev/_main.md` |
| 個別プロトコル調査 | `.claude/prompts/1_audit/individual/_main.md` |
| 全体プロトコル調査 | `.claude/prompts/7_protocol/_main.md` |

## 必須ルール

1. **セッション開始時**: CLAUDE.md→該当プロンプトを読む
2. **作業中**: 「現在: ○○.md」と工程位置を明示
3. **コミット前**: 個別プロトコル調査を実施
4. **デプロイ禁止**: ユーザー承認なしにデプロイしない

## 技術スタック

- Vanilla JS（フレームワークなし）
- PWA（Service Worker + manifest.json）
- Web Speech API（音声合成）
- Monday.com GraphQL API

## セッション

| 項目 | 内容 |
|------|------|
| 作業中 | 初期開発 |
| 完了 | - |
| 残り | Step 0-6 |
| 更新 | 2026-01-07 |

## 起動

```bash
# ローカルサーバー起動
python3 -m http.server 8080
# ブラウザで http://localhost:8080 を開く
```
