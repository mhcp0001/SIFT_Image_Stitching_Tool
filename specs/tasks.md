# Tasks Document
# SIFT Image Stitching Tool - 実装タスク一覧

**Version**: 1.0.0  
**Created**: 2025-12-12  
**Status**: Draft  
**Feature Branch**: `001-sift-image-stitching`

---

## 1. Overview

### 1.1 本文書の位置づけ

本文書は、**design.md** で定義された設計を実装するための具体的なタスク一覧を定義する。

| 文書 | 役割 |
|------|------|
| requirements.md | 何を作るか（WHAT）、なぜ作るか（WHY） |
| design.md | どう作るか（HOW） |
| **tasks.md（本文書）** | どの順序で実装するか（WHEN/ORDER） |

### 1.2 タスク記法

| 記号 | 意味 |
|------|------|
| `- [ ]` | 未着手タスク |
| `- [x]` | 完了タスク |
| `[P]` | 並列実行可能（前タスク完了後、同時実行可） |
| `_Requirements: X.X_` | 対応する要件ID |
| `_Design: §X_` | 対応する設計セクション |

### 1.3 実装フェーズ概要

```
Phase 1: プロジェクト基盤構築
    │
    ▼
Phase 2: CLI版コア機能実装
    │
    ├──► Phase 3: Web API実装 [P]
    │
    └──► Phase 4: Web UI実装 [P]（Phase 3完了後）
              │
              ▼
         Phase 5: EXE版ビルド
              │
              ▼
         Phase 6: テスト・品質保証
              │
              ▼
         Phase 7: ドキュメント整備
```

### 1.4 Prerequisites（前提条件）

- [ ] Python 3.11以上がインストールされていること
- [ ] Git がインストールされていること
- [ ] 開発用エディタ（VS Code推奨）が利用可能であること

---

## 2. Phase 1: プロジェクト基盤構築

**目標**: 開発環境とプロジェクト構造の確立

### 2.1 リポジトリ初期化

- [ ] **1.1.1** Gitリポジトリの初期化
  - `git init` 実行
  - `.gitignore` 作成（Python, IDE, OS固有ファイル除外）
  - _Requirements: -_
  - _Design: §10.1_

- [ ] **1.1.2** ディレクトリ構造の作成
  - `src/`, `web/`, `specs/`, `portable/src/` ディレクトリ作成
  - _Requirements: FR-007, FR-008, FR-009_
  - _Design: §10.1_

### 2.2 依存関係セットアップ

- [ ] **1.2.1** requirements.txt の作成
  ```
  opencv-contrib-python>=4.12.0
  numpy>=2.2.6
  scipy>=1.16.3
  scikit-image>=0.25.2
  Flask>=3.1.2
  flask-cors>=6.0.1
  ```
  - _Requirements: DEP-001, DEP-002, DEP-003_
  - _Design: §11.1_

- [ ] **1.2.2** requirements-dev.txt の作成
  ```
  pyinstaller>=6.17.0
  pyinstaller-hooks-contrib>=2025.10
  ```
  - _Requirements: DEP-004_
  - _Design: §11.2_

- [ ] **1.2.3** 仮想環境の作成と依存関係インストール
  - `python -m venv venv`
  - `pip install -r requirements.txt -r requirements-dev.txt`
  - _Requirements: -_
  - _Design: §11_

### 2.3 設定ファイル

- [P] **1.3.1** .gitignore の詳細設定
  ```
  venv/
  __pycache__/
  *.pyc
  uploads/
  results/
  *.log
  dist/
  build/
  *.spec
  ```
  - _Requirements: -_
  - _Design: -_

- [P] **1.3.2** README.md の雛形作成
  - プロジェクト概要、セットアップ手順、使用方法の骨子
  - _Requirements: -_
  - _Design: §10.1_

---

## 3. Phase 2: CLI版コア機能実装

**目標**: コマンドラインから実行可能な画像合成機能の実装

### 3.1 基本構造

- [ ] **2.1.1** src/main.py の基本構造作成
  - エントリーポイント（`if __name__ == "__main__"`）
  - 設定パラメータの定義（グローバル定数）
  - _Requirements: FR-009_
  - _Design: §4.1, §4.2_

- [ ] **2.1.2** ログ機能の実装
  - ログファイル（stitch.log）への追記モード書き込み
  - タイムスタンプ付きログ出力関数
  - CONFIG出力機能
  - _Requirements: FR-015, US-010_
  - _Design: §8.4_

### 3.2 入力処理

- [ ] **2.2.1** 広角画像読み込み機能
  - `cv.imread()` によるファイル読み込み
  - 読み込み失敗時のエラーハンドリング
  - _Requirements: FR-001, US-001_
  - _Design: §3.1 Phase 2, §9.1_

- [ ] **2.2.2** クローズアップ画像検索機能
  - `glob.glob()` によるファイル検索
  - ファイル名ソート
  - 0件時のエラーハンドリング
  - _Requirements: FR-001, US-001_
  - _Design: §3.1 Phase 2, §8.1_

### 3.3 SIFT処理

- [ ] **2.3.1** SIFT検出器の初期化
  - `cv.SIFT_create()` でのインスタンス生成
  - パラメータ設定（nfeatures, nOctaveLayers, contrastThreshold, edgeThreshold）
  - _Requirements: FR-002_
  - _Design: §4.3, §5.1_

- [ ] **2.3.2** 特徴量抽出関数の実装
  - グレースケール変換
  - `detectAndCompute()` 実行
  - 特徴量不足時のエラーハンドリング
  - _Requirements: FR-002_
  - _Design: §5.1.1_

- [ ] **2.3.3** マッチャーの実装
  - FLANN マッチャー（KD木）
  - BFMatcher（フォールバック用）
  - USE_FLANN フラグによる切り替え
  - _Requirements: FR-002_
  - _Design: §4.4, §5.1_

- [ ] **2.3.4** Lowe's ratio test の実装
  - kNNマッチング（k=2）
  - ratio test によるフィルタリング
  - 良好マッチ数のログ出力
  - _Requirements: FR-002_
  - _Design: §5.1.1, §5.1.2_

### 3.4 ホモグラフィ推定

- [ ] **2.4.1** ホモグラフィ計算関数の実装
  - 座標点の抽出と変換
  - `cv.findHomography()` with RANSAC
  - インライア率の計算とログ出力
  - _Requirements: FR-003_
  - _Design: §5.2, §4.5_

- [ ] **2.4.2** ホモグラフィ検証関数の実装
  - 条件数チェック（閾値: 10.0）
  - 行列式チェック（範囲: 0.01-100.0）
  - 射影成分チェック（閾値: 0.01）
  - 検証失敗時の警告ログ出力
  - _Requirements: FR-012_
  - _Design: §5.3_

### 3.5 ブレンディング

- [ ] **2.5.1** キャンバス作成機能
  - 広角画像のリサイズ（CANVAS_SCALE倍）
  - INTER_CUBIC補間
  - _Requirements: FR-004_
  - _Design: §3.1 Phase 3_

- [ ] **2.5.2** ワープ変換関数の実装
  - `cv.warpPerspective()` による画像変換
  - マスク画像の同時変換
  - _Requirements: FR-004_
  - _Design: §5.4.1, §5.4.2_

- [ ] **2.5.3** マスク生成関数の実装
  - ガウシアンブラー適用
  - 0-1正規化
  - _Requirements: FR-004_
  - _Design: §5.4.3_

- [ ] **2.5.4** アルファブレンド関数の実装
  - `blended = canvas * (1.0 - mask) + warped * mask`
  - float32変換と0-255クリップ
  - _Requirements: FR-004_
  - _Design: §5.4.4_

### 3.6 メインループ

- [ ] **2.6.1** 合成ループの実装
  - クローズアップ画像の順次処理
  - 成功/失敗カウンター
  - 進捗ログ出力
  - _Requirements: FR-010, US-003_
  - _Design: §3.1 Phase 4_

- [ ] **2.6.2** 結果出力機能
  - PNG形式での保存
  - サマリーログ出力
  - _Requirements: FR-006, US-005_
  - _Design: §3.1 Phase 5, §8.2_

### 3.7 高速化オプション

- [P] **2.7.1** ダウンサンプリング機能
  - マッチング用縮小画像生成
  - 座標のスケール変換
  - _Requirements: NFR-001_
  - _Design: §4.2_

- [P] **2.7.2** 並列処理の実装
  - `ThreadPoolExecutor` によるワーカープール
  - `as_completed()` による結果収集
  - メインスレッドでのブレンド実行
  - _Requirements: NFR-001_
  - _Design: §3.2_

---

## 4. Phase 3: Web API実装

**目標**: REST APIによるWeb版バックエンドの実装

**前提**: Phase 2 完了

### 4.1 Flask基本構造

- [ ] **3.1.1** src/api.py の基本構造作成
  - Flaskアプリケーション初期化
  - CORS設定
  - 静的ファイル配信設定
  - _Requirements: FR-014_
  - _Design: §2.1, §2.2_

- [ ] **3.1.2** ジョブ管理機構の実装
  - ジョブID生成（UUID v4）
  - ジョブステータス管理（辞書）
  - ステータス値: uploaded, processing, completed, failed
  - _Requirements: FR-014_
  - _Design: §6.4_

### 4.2 アップロードAPI

- [ ] **3.2.1** POST /api/upload エンドポイント
  - multipart/form-data 受信
  - ファイル形式検証（PNG, JPEG）
  - uploads/{job_id}/ ディレクトリ作成
  - ファイル保存
  - _Requirements: FR-001, US-001_
  - _Design: §6.2, §8.3_

- [ ] **3.2.2** ファイルサイズ制限の設定
  - MAX_CONTENT_LENGTH = 100MB
  - _Requirements: NFR-011_
  - _Design: §6.2_

### 4.3 合成API

- [ ] **3.3.1** POST /api/stitch エンドポイント
  - リクエストパラメータの解析
  - バックグラウンドスレッド起動
  - _Requirements: FR-002, FR-003, FR-004, US-002_
  - _Design: §6.3_

- [ ] **3.3.2** バックグラウンド処理の実装
  - main.py のロジック再利用/呼び出し
  - ステータス更新
  - 進捗情報の記録
  - _Requirements: FR-005, US-002_
  - _Design: §2.3_

### 4.4 ステータスAPI

- [ ] **3.4.1** GET /api/status/{job_id} エンドポイント
  - ジョブステータス返却
  - 進捗率返却
  - ログ一覧返却
  - _Requirements: FR-005_
  - _Design: §6.4_

- [ ] **3.4.2** GET /api/stream/{job_id} エンドポイント（SSE）
  - Server-Sent Events 実装
  - イベントタイプ: log, progress, complete, error
  - ポーリング間隔: 0.5秒
  - _Requirements: FR-005, US-002_
  - _Design: §6.5_

### 4.5 結果API

- [ ] **3.5.1** GET /api/result/{job_id} エンドポイント
  - 結果画像のバイナリ返却
  - Content-Type: image/png
  - _Requirements: FR-006, US-005_
  - _Design: §6.6_

- [ ] **3.5.2** GET /api/download/{job_id} エンドポイント
  - ダウンロード用ヘッダー設定
  - ファイル名の自動生成（日時ベース）
  - _Requirements: FR-006, US-005_
  - _Design: §6.7_

### 4.6 エラーハンドリング

- [ ] **3.6.1** APIエラーレスポンスの実装
  - 400エラー（バリデーション失敗）
  - 404エラー（リソース未発見）
  - 500エラー（サーバーエラー）
  - _Requirements: FR-010, US-003_
  - _Design: §9.3_

---

## 5. Phase 4: Web UI実装

**目標**: ブラウザベースのユーザーインターフェース実装

**前提**: Phase 3 の §3.1, §3.2 完了

### 5.1 HTML構造

- [ ] **4.1.1** web/index.html の基本構造作成
  - DOCTYPE, head, body
  - Tailwind CSS CDN読み込み
  - viewport設定
  - _Requirements: FR-007, US-006_
  - _Design: §7.1, §11.3_

- [ ] **4.1.2** ヘッダーセクション
  - タイトル: "SIFT Image Stitching Tool"
  - サブタイトル
  - _Requirements: NFR-007_
  - _Design: §7.1_

- [ ] **4.1.3** 左パネル（入力エリア）
  - Step1: 広角画像ドロップゾーン
  - Step2: クローズアップ画像ドロップゾーン
  - Step3: パラメータ設定
  - 合成開始ボタン
  - _Requirements: FR-007, US-006_
  - _Design: §7.1, §7.2_

- [ ] **4.1.4** 右パネル（出力エリア）
  - 処理状況パネル（初期非表示）
  - 結果パネル（初期非表示）
  - 使い方パネル
  - _Requirements: FR-007, US-006_
  - _Design: §7.1_

### 5.2 UIコンポーネント

- [ ] **4.2.1** ドロップゾーンの実装
  - ボーダースタイル（dashed）
  - ホバー/ドラッグ状態のスタイル
  - クリック/ドラッグ&ドロップ対応
  - _Requirements: US-006_
  - _Design: §7.2.1_

- [ ] **4.2.2** プレビュー表示の実装
  - サムネイル表示（max 150x150）
  - グリッドレイアウト（クローズアップ）
  - _Requirements: US-006_
  - _Design: §7.2.2_

- [ ] **4.2.3** パラメータスライダーの実装
  - Canvas Scale (1-5)
  - Blend Strength (11-71)
  - SIFT Min Matches (8-30)
  - 値のリアルタイム表示
  - _Requirements: US-006_
  - _Design: §7.2.3_

- [ ] **4.2.4** チェックボックスの実装
  - FLANNマッチャー使用
  - ダウンサンプリング有効
  - 並列処理有効
  - _Requirements: US-006_
  - _Design: §7.2.4_

- [ ] **4.2.5** ステータスバッジの実装
  - 状態別の色分け
  - 処理中のパルスアニメーション
  - _Requirements: FR-005_
  - _Design: §7.2.5_

- [ ] **4.2.6** 進捗バーの実装
  - パーセンテージ表示
  - アニメーション付き
  - _Requirements: FR-005, US-002_
  - _Design: §7.1_

### 5.3 JavaScript実装

- [ ] **4.3.1** web/app.js の基本構造
  - 状態オブジェクト初期化
  - DOMContentLoaded イベント
  - _Requirements: FR-007_
  - _Design: §7.3_

- [ ] **4.3.2** ドラッグ&ドロップ処理
  - dragover, dragleave, drop イベント
  - FileReader によるプレビュー生成
  - 状態更新
  - _Requirements: US-006_
  - _Design: §7.4_

- [ ] **4.3.3** API通信（アップロード）
  - FormData 構築
  - fetch() による POST /api/upload
  - レスポンス処理
  - _Requirements: FR-001_
  - _Design: §6.2_

- [ ] **4.3.4** API通信（合成開始）
  - パラメータ収集
  - fetch() による POST /api/stitch
  - _Requirements: FR-002_
  - _Design: §6.3_

- [ ] **4.3.5** SSE接続処理
  - EventSource 初期化
  - イベントハンドラ（log, progress, complete, error）
  - 接続クローズ処理
  - _Requirements: FR-005_
  - _Design: §6.5, §7.4_

- [ ] **4.3.6** 結果表示処理
  - 統計情報表示（成功/失敗数）
  - 結果画像プレビュー
  - ダウンロードボタン活性化
  - _Requirements: FR-006, US-005_
  - _Design: §7.4_

- [ ] **4.3.7** キャンセル機能
  - キャンセルボタン
  - EventSource クローズ
  - UI初期化
  - _Requirements: FR-013, US-009_
  - _Design: §7.4_

### 5.4 UIテキスト（日本語化）

- [ ] **4.4.1** 全UIテキストの日本語化
  - ラベル、ボタン、メッセージ
  - エラーメッセージ
  - ヘルプテキスト
  - _Requirements: NFR-007, NFR-008_
  - _Design: §7_

---

## 6. Phase 5: EXE版ビルド

**目標**: Windows用スタンドアロン実行ファイルの作成

**前提**: Phase 3, Phase 4 完了

### 6.1 ランチャー実装

- [ ] **5.1.1** launcher.py の実装
  - リソースパス解決（PyInstaller対応）
  - Flask サーバー起動
  - デフォルトブラウザ自動起動
  - _Requirements: FR-008, US-007_
  - _Design: §2.2, §10.2_

- [ ] **5.1.2** ポート番号処理
  - デフォルトポート設定
  - ポート競合時の処理
  - _Requirements: US-007_
  - _Design: §2.1_

### 6.2 PyInstallerビルド

- [ ] **5.2.1** .spec ファイルの作成
  - 単一ファイルモード（--onefile）
  - データファイル指定（web/）
  - アイコン設定
  - _Requirements: FR-008_
  - _Design: §10.1_

- [ ] **5.2.2** ビルドスクリプトの作成
  - build.bat（Windows用）
  - ビルドコマンドの定義
  - _Requirements: FR-008_
  - _Design: §11.2_

- [ ] **5.2.3** EXEビルドの実行と検証
  - `pyinstaller launcher.py --onefile --windowed`
  - 生成物の動作確認
  - _Requirements: FR-008, US-007_
  - _Design: §10.1_

### 6.3 ポータブル版

- [P] **5.3.1** portable/src/ へのファイルコピー
  - main.py, api.py の配置
  - 相対パス調整
  - _Requirements: FR-008_
  - _Design: §10.1_

---

## 7. Phase 6: テスト・品質保証

**目標**: 動作確認と品質担保

**前提**: Phase 5 完了

### 7.1 単体テスト（手動）

- [ ] **6.1.1** SIFT処理のテスト
  - 特徴量抽出の動作確認
  - マッチング精度の確認
  - _Requirements: FR-002_
  - _Design: §5.1_

- [ ] **6.1.2** ホモグラフィ検証のテスト
  - 正常ケース（有効な変換行列）
  - 異常ケース（条件数超過、行列式異常等）
  - _Requirements: FR-003, FR-012_
  - _Design: §5.2, §5.3_

- [ ] **6.1.3** ブレンディングのテスト
  - 境界の滑らかさ確認
  - カラー/グレースケール対応
  - _Requirements: FR-004_
  - _Design: §5.4_

### 7.2 統合テスト（手動）

- [ ] **6.2.1** CLI版エンドツーエンドテスト
  - 10枚のクローズアップ画像での合成
  - 処理時間の計測（目標: 5分以内）
  - _Requirements: NFR-001, US-002_
  - _Design: §3.1_

- [ ] **6.2.2** Web版エンドツーエンドテスト
  - アップロード→合成→ダウンロードの一連フロー
  - 進捗表示の動作確認
  - _Requirements: FR-007, US-006_
  - _Design: §7.4_

- [ ] **6.2.3** EXE版動作テスト
  - ダブルクリック起動
  - ブラウザ自動起動
  - 一連の操作フロー
  - _Requirements: FR-008, US-007_
  - _Design: §10.1_

### 7.3 エラーケーステスト

- [ ] **6.3.1** 入力エラーのテスト
  - 不正ファイル形式
  - 広角画像なし
  - クローズアップ0件
  - _Requirements: FR-010, US-003_
  - _Design: §9.1, §9.3_

- [ ] **6.3.2** 処理エラーのテスト
  - 特徴量不足画像
  - マッチング失敗画像
  - 部分失敗時の継続確認
  - _Requirements: FR-010, US-003_
  - _Design: §9.2_

### 7.4 ユーザビリティテスト

- [ ] **6.4.1** 非技術者による操作テスト
  - 初回利用時の学習時間計測（目標: 5分以内）
  - 操作の直感性確認
  - _Requirements: NFR-005, NFR-006_
  - _Design: §7_

---

## 8. Phase 7: ドキュメント整備

**目標**: ユーザー向け・開発者向けドキュメントの完成

**前提**: Phase 6 完了

### 8.1 ユーザー向けドキュメント

- [ ] **7.1.1** README.md の完成
  - プロジェクト概要
  - インストール手順
  - 使用方法（スクリーンショット付き）
  - _Requirements: -_
  - _Design: §10.1_

- [P] **7.1.2** 使い方ガイド（Web UI内）の完成
  - ステップバイステップの説明
  - 撮影時のTips（オーバーラップ推奨等）
  - _Requirements: NFR-006_
  - _Design: §7.1_

### 8.2 開発者向けドキュメント

- [P] **7.2.1** DEVELOPMENT.md の作成
  - 開発環境セットアップ
  - ビルド手順
  - デバッグ方法
  - _Requirements: -_
  - _Design: §10.1_

- [P] **7.2.2** CLAUDE.md の更新
  - AI向け開発ガイド
  - コード規約
  - _Requirements: -_
  - _Design: §10.1_

### 8.3 SDD文書

- [ ] **7.3.1** specs/ 配下の文書最終化
  - requirements.md 最終レビュー
  - design.md 最終レビュー
  - tasks.md 最終レビュー
  - _Requirements: -_
  - _Design: §10.1_

---

## 9. Task Dependencies（依存関係図）

```
Phase 1: プロジェクト基盤
├── 1.1.1 Git初期化
├── 1.1.2 ディレクトリ作成 ──────────────────────────┐
├── 1.2.1 requirements.txt                          │
├── 1.2.2 requirements-dev.txt                      │
├── 1.2.3 仮想環境セットアップ ◄─── 1.2.1, 1.2.2    │
├── [P] 1.3.1 .gitignore                            │
└── [P] 1.3.2 README.md雛形                         │
                                                    │
Phase 2: CLI版コア機能 ◄────────────────────────────┘
├── 2.1.1 main.py基本構造
├── 2.1.2 ログ機能 ◄─── 2.1.1
├── 2.2.1 広角画像読み込み ◄─── 2.1.2
├── 2.2.2 クローズアップ検索 ◄─── 2.1.2
├── 2.3.1 SIFT検出器 ◄─── 2.2.1, 2.2.2
├── 2.3.2 特徴量抽出 ◄─── 2.3.1
├── 2.3.3 マッチャー ◄─── 2.3.2
├── 2.3.4 Lowe's ratio test ◄─── 2.3.3
├── 2.4.1 ホモグラフィ計算 ◄─── 2.3.4
├── 2.4.2 ホモグラフィ検証 ◄─── 2.4.1
├── 2.5.1 キャンバス作成 ◄─── 2.2.1
├── 2.5.2 ワープ変換 ◄─── 2.4.2, 2.5.1
├── 2.5.3 マスク生成 ◄─── 2.5.2
├── 2.5.4 アルファブレンド ◄─── 2.5.3
├── 2.6.1 合成ループ ◄─── 2.5.4
├── 2.6.2 結果出力 ◄─── 2.6.1
├── [P] 2.7.1 ダウンサンプリング ◄─── 2.6.2
└── [P] 2.7.2 並列処理 ◄─── 2.6.2
                │
                ├───────────────────────────┐
                ▼                           │
Phase 3: Web API                            │
├── 3.1.1 api.py基本構造                    │
├── 3.1.2 ジョブ管理 ◄─── 3.1.1             │
├── 3.2.1 アップロードAPI ◄─── 3.1.2        │
├── 3.2.2 サイズ制限 ◄─── 3.2.1             │
├── 3.3.1 合成API ◄─── 3.2.2                │
├── 3.3.2 バックグラウンド処理 ◄─── 3.3.1   │
├── 3.4.1 ステータスAPI ◄─── 3.3.2          │
├── 3.4.2 SSE API ◄─── 3.4.1                │
├── 3.5.1 結果API ◄─── 3.3.2                │
├── 3.5.2 ダウンロードAPI ◄─── 3.5.1        │
└── 3.6.1 エラーハンドリング ◄─── 3.5.2     │
                │                           │
                ▼                           │
Phase 4: Web UI ◄───────────────────────────┘
├── 4.1.1 HTML基本構造
├── 4.1.2 ヘッダー ◄─── 4.1.1
├── 4.1.3 左パネル ◄─── 4.1.2
├── 4.1.4 右パネル ◄─── 4.1.2
├── 4.2.1 ドロップゾーン ◄─── 4.1.3
├── 4.2.2 プレビュー表示 ◄─── 4.2.1
├── 4.2.3 パラメータスライダー ◄─── 4.1.3
├── 4.2.4 チェックボックス ◄─── 4.1.3
├── 4.2.5 ステータスバッジ ◄─── 4.1.4
├── 4.2.6 進捗バー ◄─── 4.1.4
├── 4.3.1 app.js基本構造
├── 4.3.2 D&D処理 ◄─── 4.3.1, 4.2.1
├── 4.3.3 アップロード通信 ◄─── 4.3.2
├── 4.3.4 合成開始通信 ◄─── 4.3.3
├── 4.3.5 SSE接続 ◄─── 4.3.4
├── 4.3.6 結果表示 ◄─── 4.3.5
├── 4.3.7 キャンセル機能 ◄─── 4.3.5
└── 4.4.1 日本語化 ◄─── 4.3.7
                │
                ▼
Phase 5: EXE版ビルド
├── 5.1.1 launcher.py
├── 5.1.2 ポート処理 ◄─── 5.1.1
├── 5.2.1 .specファイル ◄─── 5.1.2
├── 5.2.2 ビルドスクリプト ◄─── 5.2.1
├── 5.2.3 ビルド実行 ◄─── 5.2.2
└── [P] 5.3.1 ポータブル版 ◄─── 5.2.3
                │
                ▼
Phase 6: テスト
├── 6.1.1-6.1.3 単体テスト
├── 6.2.1-6.2.3 統合テスト ◄─── 6.1.*
├── 6.3.1-6.3.2 エラーテスト ◄─── 6.2.*
└── 6.4.1 ユーザビリティテスト ◄─── 6.3.*
                │
                ▼
Phase 7: ドキュメント
├── 7.1.1 README.md
├── [P] 7.1.2 使い方ガイド
├── [P] 7.2.1 DEVELOPMENT.md
├── [P] 7.2.2 CLAUDE.md
└── 7.3.1 SDD文書最終化
```

---

## 10. Estimated Effort（工数見積り）

| Phase | タスク数 | 推定工数 |
|-------|-------:|-------:|
| Phase 1: プロジェクト基盤 | 7 | 2時間 |
| Phase 2: CLI版コア機能 | 17 | 16時間 |
| Phase 3: Web API | 11 | 8時間 |
| Phase 4: Web UI | 18 | 12時間 |
| Phase 5: EXE版ビルド | 6 | 4時間 |
| Phase 6: テスト | 8 | 6時間 |
| Phase 7: ドキュメント | 5 | 4時間 |
| **合計** | **72** | **52時間** |

---

## 11. Progress Tracking（進捗管理）

| Phase | 完了タスク | 総タスク | 進捗率 |
|-------|----------:|--------:|-------:|
| Phase 1 | 0 | 7 | 0% |
| Phase 2 | 0 | 17 | 0% |
| Phase 3 | 0 | 11 | 0% |
| Phase 4 | 0 | 18 | 0% |
| Phase 5 | 0 | 6 | 0% |
| Phase 6 | 0 | 8 | 0% |
| Phase 7 | 0 | 5 | 0% |
| **Total** | **0** | **72** | **0%** |

---

## 12. Revision History（改訂履歴）

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-12 | - | 初版作成 |

---

## 13. References（参照文書）

| 文書 | パス | 説明 |
|------|------|------|
| 要件定義書 | specs/requirements.md | 実装する要件の定義 |
| 設計書 | specs/design.md | 実装の技術的詳細 |
