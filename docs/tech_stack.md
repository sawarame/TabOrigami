# 🕊️ TabOrigami 技術スタック仕様書

## 1. 開発言語・基本環境

- **言語:** TypeScript (v5系)
  - **選定理由:** Chrome Extension API（`chrome.tabs`や`chrome.storage`など）の型定義（`@types/chrome`）を活用することで、typoやAPIの仕様変更によるバグをコンパイル時に防ぐため。

- **パッケージマネージャー:** npm または pnpm
- **対象プラットフォーム:** Google Chrome (Manifest V3)

## 2. フロントエンド（UIレイヤー）

- **フレームワーク:** Vue.js (Vue 3 / Composition API)
  - **用途:** ポップアップ（アイコンクリック時に開くUI）の構築。
  - **選定理由:** 状態管理（リアクティビティ）が強力であり、「AIが分類中（ローディング）」「プレビュー画面でのチェックボックス操作」「Undoボタンの表示」といった複雑な状態変化を宣言的にシンプルに記述できるため。

- **コンポーネント設計:** 単一ファイルコンポーネント (SFC: `.vue`ファイル) を採用。

## 3. ビルドシステム

- **モジュールバンドラー:** Webpack (v5系)
  - **構成のポイント:** Chrome拡張機能は「ポップアップ（HTML/JS）」と「バックグラウンド（Service Worker）」の独立した環境を持つため、Webpackの設定（`webpack.config.js`）で**マルチエントリーポイント**を構成し、それぞれの出力ファイルを分割してビルドします。

- **主要ローダー・プラグイン:**
  - `ts-loader`: TypeScriptのトランスパイル。
  - `vue-loader`: `.vue`ファイルのパースとビルド。
  - `copy-webpack-plugin`: `manifest.json` やアイコン画像（SVG/PNG）、ポップアップ用のベースとなる `index.html` を `dist` ディレクトリへそのままコピーする役割。

## 4. アーキテクチャ構成 (Manifest V3)

拡張機能内部は、大きく2つのコンテキストに分けて実装します。

### A. Popup (フロントエンド側)

- **役割:** ユーザーからの入力受け付け、Gemini Nanoへの処理開始リクエスト、分類プレビューの描画、チェックボックスによる微調整。
- **技術:** Vue 3 + TypeScript
- **通信:** バックグラウンド処理が必要な場合は `chrome.runtime.sendMessage` を使用。

### B. Background (Service Worker側)

- **役割:** 拡張機能のライフサイクル管理、状態の永続化、タブの操作。
- **使用API:**
  - `chrome.tabs.query / group / create`: タブの取得とグループ化、Undo時の復元。
  - `chrome.tabGroups.update`: グループ名や色の設定。
  - `chrome.storage.local`: 「Undo（自動バックアップ）」用の実行前タブ状態の保存。

- **非同期処理の注意点:** Service Workerは一定時間でスリープするため、状態（どのタブを選んだか等）はメモリ上の変数ではなく `chrome.storage` に持たせる設計とします。

## 5. Built-in AI (Gemini Nano) の連携方針

- **利用API:** Prompt API (`ai.languageModel.prompt`)
- **実行コンテキスト:** ポップアップ側のVueコンポーネント内、またはBackgroundのどちらからでも呼び出し可能ですが、処理中にポップアップが閉じられてしまう（フォーカスが外れる）リスクを考慮し、**時間のかかるAI推論処理はBackground (Service Worker) 側に委譲**し、Vue側はローディングスピナーを表示して待機する設計を推奨します。
