# 🕊️ TabOrigami プロジェクトガイド

## プロジェクト概要
TabOrigamiは、Gemini AI（クラウド版およびGemini Nano）を活用して、散らかったブラウザのタブを文脈に基づいて賢く整理（折りたたみ）するGoogle Chrome拡張機能です。ユーザーが選択した「折り方（整理スタイル）」に合わせて、AIが最適なタブグループを生成します。

### 主な機能
- **AI整理:** おまかせ、タスク集中、オン・オフ、断捨離の4つのスタイルでタブを分類。
- **プレビュー & 微調整:** AIの提案を確定前に確認し、チェックボックスで調整可能。
- **Undo機能:** 整理前の状態にいつでも戻せるバックアップ機能。
- **BYOK方式:** ユーザー自身のGemini APIキーを使用して、最新のモデル（Gemini 2.5 Flash等）を利用可能。

### 技術スタック
- **言語:** TypeScript (v5+)
- **フレームワーク:** Vue.js 3 (Composition API)
- **ビルドツール:** Webpack 5, ts-loader, vue-loader
- **拡張機能仕様:** Manifest V3
- **AI連携:** Gemini API (Google AI Studio)

## 開発・ビルドコマンド
プロジェクトのビルドやアイコン生成には以下のコマンドを使用します。

- **依存関係のインストール:**
  ```bash
  npm install
  ```
- **プロジェクトのビルド:**
  ```bash
  npm run build
  ```
  実行後、`TabOrigami/js/` フォルダにJSファイルが出力され、ルートに `TabOrigami.zip` が生成されます。
- **アイコンの生成:**
  ```bash
  node generate_icons.js
  ```
  `src/icon.svg` を元に、拡張機能に必要な各サイズのPNG画像を `TabOrigami/icons/` に生成します。

## ディレクトリ構成
- `src/`: TypeScript/Vueソースコード
  - `background/`: Service Worker（AI連携、タブ操作ロジック）
  - `popup/`: ポップアップUI（Vueコンポーネント）
  - `options/`: 設定画面（APIキー・モデル設定）
- `TabOrigami/`: 拡張機能のパッケージ本体
  - `manifest.json`: 拡張機能の設定ファイル
  - `popup.html`, `options.html`: 各画面のHTML
  - `js/`: ビルド済みスクリプト出力先
  - `icons/`: 拡張機能アイコン
- `docs/`: 仕様書・技術スタック資料

## 開発上の注意点
- **APIキーの管理:** APIキーは `chrome.storage.local` に保存されます。開発時はオプション画面から自分のキーを設定してください。
- **型定義:** Chrome APIの型定義（`@types/chrome`）を活用し、安全な開発を心がけてください。
- **ドキュメント:** コード内のコメントやドキュメントには日本語を使用します。
