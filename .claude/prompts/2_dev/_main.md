# 開発（大プロンプト）

**新規開発・バグ修正共通。スキップ禁止。**

---

## 必須ルール

1. 各工程で「現在位置: X/Y.md」を出力
2. 問題発生 → 即停止 → ユーザーに報告
3. 完了後 → `3_deploy/_main.md` へ進め

---

## 実行順序

### 1. 準備
```
→ 1_prepare/investigate.md  ← バグ修正時のみ（症状・原因・修正案）
→ 1_prepare/plan.md         ← 計画提示・承認取得 ★必須
→ 1_prepare/backup.md
```

### 2. 実装
```
→ 2_implement/implement.md
→ 2_implement/type_check.md
```

### 3. テスト依頼
```
→ 3_test/request.md
```

### 4. 完了
```
→ 3_complete/commit.md
→ 3_complete/deploy.md      ← 本番適用
→ 3_complete/verify.md      ← 動作確認
```

---

## 完了時

```bash
afplay /System/Library/Sounds/Glass.aiff
```

---

## 禁止

- 本番DBへの直接UPDATE/DELETE
- バックアップなしの修正
- ユーザー承認なしの実装開始
