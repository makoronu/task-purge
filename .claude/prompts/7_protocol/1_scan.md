# コード走査

## やること

- Grepでハードコーディング箇所を検出
- 対象: マジックナンバー、マジックストリング、直書き値

## 検出パターン

```bash
# エラーメッセージ
HTTPException.*detail=

# placeholder
placeholder=

# 日付フォーマット
strftime|toLocaleDateString
```

## 完了条件

- [ ] 対象箇所をリスト化した

## 次 → 2_classify.md
