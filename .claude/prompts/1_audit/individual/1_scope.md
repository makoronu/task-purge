# 変更範囲特定

## やること

1. 変更ファイル一覧を取得
2. 変更行数を確認
3. 変更種別を分類（DB/API/フロント）

---

## コマンド

```bash
# 直近コミットとの差分
git diff --name-only HEAD~1
git diff --stat HEAD~1

# 特定コミットとの差分
git diff --name-only <commit-hash>

# mainブランチとの差分
git diff --name-only main
```

---

## 出力フォーマット

```
【変更範囲】
- 変更ファイル数: X件
- 追加行数: +XXX
- 削除行数: -XXX

【変更種別】
- [ ] DB変更（マイグレーション）
- [ ] API変更（エンドポイント）
- [ ] フロント変更（コンポーネント）
- [ ] 設定変更（定数、環境変数）

【対象ファイル】
1. path/to/file1.py
2. path/to/file2.tsx
...
```

---

## 完了条件

- [ ] 変更ファイル一覧を把握した
- [ ] 変更種別を分類した

## 次の工程

→ 2_protocol.md
