---
name: mermaid-feedback
description: Markdown ファイル中の Mermaid 図をローカル MCP でレンダリングし、視覚的に確認してフィードバックループで改善する。文字の重なり、レイアウト崩れ、見た目の問題を自律的に検出・修正する。
user-invocable: true
argument-hint: "<file-path-or-glob> -- e.g. docs/00-overview/*.md"
---

# Mermaid Visual Feedback Loop Skill

Markdown ファイル中の Mermaid 図をローカル MCP (`mcp__mermaid-local__render_mermaid`) でレンダリングし、返された PNG 画像を視覚的に確認してフィードバックループで自律的に改善する。

## 前提条件

- `mermaid-local` MCP サーバーが有効であること（`.mcp.json` に設定済み）
- mmdc（@mermaid-js/mermaid-cli）が npx 経由で利用可能であること

## ツール

| ツール | 用途 |
|---|---|
| `mcp__mermaid-local__render_mermaid` | **プライマリ** -- ローカル mmdc でレンダリング、PNG 画像を返す |
| `mcp__mermaidchart__validate_and_render_mermaid_diagram` | **フォールバック** -- mermaid-local が利用不可の場合 |
| `mcp__mermaidchart__get_mermaid_syntax_document` | 構文リファレンス取得（不明な図の種類がある場合） |

## ワークフロー

### Phase 1: 対象ファイルの特定と Mermaid ブロック抽出

1. 引数で指定されたファイル（またはglob）を Read で読み込む
2. ファイル内の全 ` ```mermaid ` ブロックを特定する
3. 各ブロックに番号を振り、一覧を作成する（ファイル名、行番号、図の種類）

### Phase 2: レンダリングと視覚確認（図ごとに繰り返し）

各 Mermaid ブロックについて以下を実行:

1. **レンダリング**
   - `mcp__mermaid-local__render_mermaid` を呼び出す
   - パラメータ:
     - `mermaidCode`: 抽出した Mermaid コード
     - `theme`: "default" (デフォルト) / "forest" / "dark" / "neutral"
     - `scale`: 2 (デフォルト、高解像度)
   - PNG 画像と mermaid.live プレビューリンクが返される
   - エラーの場合は stderr の内容が返される

2. **視覚評価**
   - 返された PNG 画像を確認し、以下の観点で評価する

### Phase 3: 問題の検出と分類

レンダリング結果の画像から以下の問題を検出する:

| 問題カテゴリ | 具体的な症状 | 重大度 |
|---|---|---|
| **文字の重なり** | ノード内テキストがはみ出す、ラベル同士が重なる、エッジラベルがノードと被る | HIGH |
| **レイアウト崩れ** | ノード同士が重なる、矢印が交差しすぎ、余白が不均一、subgraph からノードがはみ出す | HIGH |
| **視認性の問題** | 色のコントラスト不足、文字が小さすぎる、図全体が詰まりすぎ | MEDIUM |
| **構造の問題** | 情報の流れが不自然、グルーピングが不適切 | LOW |
| **構文エラー** | レンダリング自体が失敗（MCP がエラー詳細を返す） | CRITICAL |

### Phase 4: 修正と再確認のループ

問題が検出された場合:

1. **修正方針を決定** -- 問題の種類に応じて以下のテクニックを適用:

   **文字の重なり対策:**
   - ノードのラベルを短縮する（改行 `<br/>` の活用）
   - 日本語ラベルを英語に変更する（Mermaid のフォントメトリクスは英語前提のため、日本語だとノードサイズ計算がずれて文字が被りやすい）
   - `graph LR` を `graph TB` に変更してスペースを確保
   - subgraph を使って密集したノードを分離
   - sequenceDiagram の participant 名を短縮する

   **レイアウト改善:**
   - `graph` の方向を変更 (LR/TB/RL/BT) -- nested subgraph が多い場合は TB が安定
   - 不要なノード・エッジを削減して情報密度を下げる
   - subgraph で論理的なグルーピングを明確化
   - subgraph 内部の `direction` を親と異ならせて疎密を制御する
   - 接続の少ない subgraph は見えない接続で位置を誘導する
   - sequenceDiagram では participant の並び順を最適化（接続が多いペアを隣接させる）

   **視認性改善:**
   - classDef でコントラストの高い配色に変更
   - fill と stroke の色の組み合わせを見直す（淡い fill + 濃い stroke + 暗い fontColor）
   - レイヤーごとに色系統を分ける（例: ユーザー=紫系、AWS=オレンジ系、外部=青系）

   **Mermaid 構文のベストプラクティス:**
   - sequenceDiagram では `style` / `classDef` は使えない
   - `graph` / `flowchart` では classDef + class で色を適用
   - erDiagram では関係線のラベルは短く
   - journey 図ではセクション名を簡潔に
   - subgraph 内の接続は subgraph ブロック内で定義するとレイアウトが安定する

2. **修正コードを再度 `mcp__mermaid-local__render_mermaid` でレンダリング**
3. **新しい PNG 画像を確認し、問題が解消されたか評価**
4. **問題が解消されるまで繰り返す（最大3回）**
5. **確定したコードで元の .md ファイルの該当ブロックを Edit で更新**

### Phase 5: 完了報告

全図の処理が終わったら以下を報告:

```
## Mermaid Diagram Improvement Report

### Results
| File | Diagram# | Type | Issues Found | Changes Made | Status |
|---|---|---|---|---|---|

### Summary
- Total diagrams processed: N
- Diagrams that needed fixes: M
- Remaining issues: (if any)
- Preview links: (mermaid.live links for each diagram)
```

## 注意事項

- 元のファイルは Edit ツールで該当の mermaid ブロックのみ更新する（他の部分は絶対に変更しない）
- 図の意味・情報量は変えない。あくまでレイアウトと見た目の改善に留める
- 大幅な構造変更（図の種類の変更、情報の追加・削除）が必要な場合はユーザーに確認を取る
- 構文エラーが出た場合は MCP が返すエラー詳細に従って修正する
