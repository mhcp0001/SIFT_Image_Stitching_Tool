# SIFT Image Stitching Tool 仕様書

**バージョン**: 1.0.0
**最終更新**: 2025-12-12
**対象**: 本仕様書は、SIFT特徴点マッチングを用いた画像合成ツールの完全再現を目的とした技術仕様を定義する

---

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [処理フロー](#3-処理フロー)
4. [パラメータ仕様](#4-パラメータ仕様)
5. [アルゴリズム詳細](#5-アルゴリズム詳細)
6. [API仕様](#6-api仕様)
7. [Web UI仕様](#7-web-ui仕様)
8. [入出力仕様](#8-入出力仕様)
9. [エラーハンドリング](#9-エラーハンドリング)
10. [ファイル構成](#10-ファイル構成)
11. [依存関係](#11-依存関係)
12. [制約事項](#12-制約事項)

---

## 1. システム概要

### 1.1 目的

本システムは、1枚の広角画像（Overview）に対して、複数の高解像度クローズアップ画像（Closeups）を自動的に位置合わせして合成することで、高解像度な最終出力画像を生成する。

### 1.2 主要機能

| 機能ID | 機能名 | 説明 |
|--------|--------|------|
| F-001 | 特徴点マッチング | SIFT（Scale-Invariant Feature Transform）アルゴリズムによる画像間の対応点検出 |
| F-002 | ホモグラフィ推定 | RANSACを用いた堅牢な幾何変換行列の計算 |
| F-003 | 画像ブレンディング | ガウシアンブラーマスクによる滑らかな境界処理 |
| F-004 | ホモグラフィ検証 | 数値的妥当性チェックによる誤マッチング排除 |
| F-005 | 並列処理 | マルチスレッドによる高速化 |
| F-006 | Web UI | ブラウザベースのユーザーインターフェース |
| F-007 | REST API | HTTPベースのプログラマティックアクセス |

### 1.3 提供形態

| 形態 | 説明 | エントリーポイント |
|------|------|------------------|
| CLI版 | コマンドラインから実行するバッチ処理形式 | src/main.py |
| Web版 | ブラウザから操作するGUI形式 | src/api.py |
| EXE版 | Windowsスタンドアロン実行ファイル | launcher.py (PyInstallerでビルド) |

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web Browser   │  │   CLI Terminal  │  │  EXE Launcher   │ │
│  │   (HTML/JS)     │  │   (Python)      │  │  (PyInstaller)  │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            │ HTTP/SSE           │ Direct Call        │ Module Import
            │                    │                    │
┌───────────┼────────────────────┼────────────────────┼───────────┐
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Application Layer                     │   │
│  │  ┌───────────────┐          ┌───────────────────────┐   │   │
│  │  │   Flask API   │◄────────►│   Core Processing     │   │   │
│  │  │   (api.py)    │          │   (main.py logic)     │   │   │
│  │  └───────────────┘          └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Library Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     OpenCV      │  │     NumPy       │  │     Flask       │ │
│  │ (SIFT, Warp,    │  │ (Array ops,     │  │ (Web Server,    │ │
│  │  Homography)    │  │  Linear Alg)    │  │  REST API)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 モジュール構成

| モジュール | ファイル | 責務 |
|-----------|----------|------|
| メインエントリ（CLI） | src/main.py | CLI実行、処理フロー制御、ログ出力 |
| Webサーバー | src/api.py | REST API提供、Web UI配信、バックグラウンド処理 |
| ランチャー | launcher.py | EXE用エントリーポイント、ブラウザ自動起動 |
| フロントエンド | web/index.html, web/app.js | Web UIのHTML/JavaScript |

### 2.3 データフロー

#### CLI版のデータフロー

```
[入力]                    [処理]                         [出力]
overview.jpg ─────┬──────► SIFT特徴量抽出 ───┐
                  │                           │
closeups/*.jpg ───┴──────► SIFT特徴量抽出 ──┬┴──► マッチング
                                             │
                                             ▼
                                       ホモグラフィ推定
                                             │
                                             ▼
                                       ホモグラフィ検証
                                             │
                                             ▼
                                         ワープ変換
                                             │
                                             ▼
                                       アルファブレンド
                                             │
                                             ▼
                                      ─────────────────
                                      │ stitched.png │
                                      │ stitch.log   │
                                      ─────────────────
```

#### Web版のデータフロー

```
[ブラウザ]              [サーバー]                    [ファイルシステム]
    │                       │                              │
    │  POST /api/upload     │                              │
    ├──────────────────────►│  uploads/{job_id}/overview_* │
    │                       ├─────────────────────────────►│
    │                       │  uploads/{job_id}/closeup_*  │
    │  {job_id}             │                              │
    │◄──────────────────────┤                              │
    │                       │                              │
    │  POST /api/stitch     │                              │
    ├──────────────────────►│  バックグラウンドスレッド開始 │
    │                       │                              │
    │  GET /api/stream/{id} │                              │
    ├──────────────────────►│                              │
    │  SSE: log             │                              │
    │◄──────────────────────┤                              │
    │  SSE: progress        │                              │
    │◄──────────────────────┤                              │
    │  SSE: complete        │  results/{job_id}.png       │
    │◄──────────────────────┤─────────────────────────────►│
    │                       │                              │
    │  GET /api/result/{id} │                              │
    ├──────────────────────►│                              │
    │  {image binary}       │                              │
    │◄──────────────────────┤                              │
```

---

## 3. 処理フロー

### 3.1 メイン処理フロー（CLI版）

#### Phase 1: 初期化

| ステップ | 処理内容 | 失敗時の動作 |
|---------|---------|-------------|
| 1.1 | ログファイル（stitch.log）を追記モードで開く | 致命的エラー、プロセス終了（exit code 1） |
| 1.2 | 現在時刻をログに記録（フォーマット: YYYY-MM-DD HH:MM:SS） | - |
| 1.3 | 設定値をログに記録 | - |
| 1.4 | OpenCVマルチスレッドを有効化（スレッド数: CPUコア数） | - |

#### Phase 2: 入力検証

| ステップ | 処理内容 | 失敗時の動作 |
|---------|---------|-------------|
| 2.1 | 広角画像（overview.jpg）を読み込む | 致命的エラー、プロセス終了 |
| 2.2 | クローズアップ画像をglobパターン（closeups/*.jpg）で検索 | 致命的エラー（0件の場合）、プロセス終了 |
| 2.3 | 発見した画像数をログに記録 | - |

#### Phase 3: 前処理

| ステップ | 処理内容 | 詳細 |
|---------|---------|------|
| 3.1 | キャンバス作成 | 広角画像をCANVAS_SCALE倍にリサイズ（補間: INTER_CUBIC） |
| 3.2 | ベース画像ダウンサンプリング | DOWNSAMPLE_SCALEで縮小（補間: INTER_AREA） |
| 3.3 | ベースSIFT特徴量計算 | グレースケール変換後、detectAndCompute実行 |
| 3.4 | スケーリング行列作成 | 3x3のアフィン変換行列（対角成分: CANVAS_SCALE） |
| 3.5 | カウンター初期化 | success_count = 0, skip_count = 0 |

#### Phase 4: 合成ループ

クローズアップ画像リストをファイル名でソートし、各画像に対して以下を実行:

| ステップ | 処理内容 | 成功条件 |
|---------|---------|---------|
| 4.1 | 画像読み込み | cv.imreadがNone以外を返す |
| 4.2 | ホモグラフィ推定 | homography_sift関数が有効な行列を返す |
| 4.3 | ホモグラフィ検証 | validate_homography関数がTrueを返す |
| 4.4 | 座標変換 | H_to_canvas = Hscale @ H |
| 4.5 | ブレンド | warp_and_blend関数でキャンバスを更新 |

成功時: success_count += 1, ログに「[blend] {filename}」出力
失敗時: skip_count += 1, ログに「[skip] {filename} : {理由}」出力

#### Phase 5: 終了処理

| ステップ | 処理内容 |
|---------|---------|
| 5.1 | 結果画像をPNG形式で保存（stitched.png） |
| 5.2 | 処理結果サマリーをログに記録 |
| 5.3 | ログファイルをクローズ |

### 3.2 並列処理フロー（USE_PARALLEL=True時）

```
[メインスレッド]                    [ワーカースレッド群]
      │                                    │
      │  ThreadPoolExecutor作成            │
      │  (max_workers=MAX_WORKERS)         │
      ├────────────────────────────────────┤
      │                                    │
      │  Future投入（全クローズアップ）     │
      ├───────────────────────────────────►│
      │                                    │ process_single_closeup()
      │                                    │ - 画像読み込み
      │                                    │ - SIFT特徴量計算
      │                                    │ - ホモグラフィ推定
      │                                    │ - ホモグラフィ検証
      │                                    │
      │  as_completed()でイテレート        │
      │◄───────────────────────────────────┤
      │                                    │
      │  warp_and_blend()                  │
      │  （メインスレッドで実行）           │
      │                                    │
```

**注意**: キャンバスへの書き込み（warp_and_blend）はスレッドセーフでないため、メインスレッドで順次実行する。

---

## 4. パラメータ仕様

### 4.1 基本パラメータ

| パラメータ名 | 型 | デフォルト値 | 範囲 | 説明 |
|-------------|----|-----------:|------|------|
| CANVAS_SCALE | int | 2 | 1-5 | 出力画像の拡大倍率。広角画像をこの倍率でリサイズしてキャンバスを作成 |
| STRENGTH | int | 31 | 11-71 (奇数) | ガウシアンブラーのカーネルサイズ。大きいほど境界が滑らか |
| SIFT_MIN_MATCHES | int | 12 | 8-30 | ホモグラフィ計算に必要な最小マッチ数 |
| SIFT_RATIO_TEST | float | 0.75 | 0.5-0.9 | Lowe's ratio testの閾値。小さいほど厳格 |

### 4.2 高速化パラメータ

| パラメータ名 | 型 | デフォルト値 | 説明 |
|-------------|----|-----------:|------|
| USE_FLANN | bool | True | FLANNマッチャー使用（Falseの場合BFMatcher） |
| MAX_FEATURES | int | 5000 | SIFT検出の最大特徴点数 |
| DOWNSAMPLE_FOR_MATCHING | bool | True | マッチング時のダウンサンプリング有効化 |
| DOWNSAMPLE_SCALE | float | 0.5 | ダウンサンプリング倍率 |
| USE_PARALLEL | bool | True | 並列処理の有効化 |
| MAX_WORKERS | int/None | None | 並列ワーカー数（NoneでCPUコア数） |

### 4.3 SIFT検出器パラメータ

| パラメータ名 | デフォルト値 | 説明 |
|-------------|------------:|------|
| nfeatures | MAX_FEATURES (5000) | 検出する最大特徴点数 |
| nOctaveLayers | 5 | オクターブあたりのレイヤー数（OpenCVデフォルト: 3） |
| contrastThreshold | 0.03 | コントラスト閾値（OpenCVデフォルト: 0.04） |
| edgeThreshold | 15 | エッジ応答閾値（OpenCVデフォルト: 10） |

### 4.4 FLANNマッチャーパラメータ

| パラメータ名 | 値 | 説明 |
|-------------|---:|------|
| algorithm | FLANN_INDEX_KDTREE (1) | インデックスアルゴリズム |
| trees | 5 | KD木の本数 |
| checks | 50 | 再帰探索回数 |

### 4.5 RANSACパラメータ

| パラメータ名 | 値 | 説明 |
|-------------|---:|------|
| ransacReprojThreshold | 3.0 | 再投影誤差閾値（ピクセル） |
| maxIters | 5000 | 最大イテレーション数 |
| confidence | 0.995 | 信頼度 |

---

## 5. アルゴリズム詳細

### 5.1 SIFT特徴量マッチング

#### 5.1.1 処理手順

1. **グレースケール変換**: 入力画像をBGRからグレースケールに変換
2. **特徴量抽出**: SIFT検出器でキーポイントとディスクリプタを計算
3. **kNNマッチング**: k=2でk近傍マッチングを実行
4. **Lowe's ratio test**: 各マッチペア(m, n)に対して `m.distance < SIFT_RATIO_TEST * n.distance` を満たすものを選別

#### 5.1.2 マッチング品質判定

- マッチ数が SIFT_MIN_MATCHES 未満の場合、ホモグラフィ計算をスキップ
- ディスクリプタがNullまたは特徴点数が不足の場合もスキップ

### 5.2 ホモグラフィ推定

#### 5.2.1 座標変換

ダウンサンプリングを考慮したキーポイント座標の変換:

```
元座標 = (キーポイント座標) / (ダウンサンプリング倍率)
```

#### 5.2.2 ホモグラフィ計算

- **アルゴリズム**: RANSAC
- **方向**: クローズアップ座標 → ベース座標
- **入力**: dst_pts（クローズアップ）, src_pts（ベース）
- **出力**: 3x3ホモグラフィ行列H

#### 5.2.3 インライア率検証

RANSACの結果マスクからインライア率を計算:
- インライア率 = (インライア数) / (全マッチ数)
- インライア率が10%未満の場合、ホモグラフィを棄却

### 5.3 ホモグラフィ検証

以下の3つの検証をすべてパスした場合のみ有効とする:

#### 5.3.1 条件数チェック

- **対象**: ホモグラフィ行列の左上2x2部分行列（回転・スケール成分）
- **判定**: 条件数(condition number) > 10.0 の場合は棄却
- **意味**: 数値的安定性の検証。高い条件数は計算誤差の増幅を示す

#### 5.3.2 行列式チェック

- **対象**: ホモグラフィ行列全体
- **判定**: 行列式が 0.01未満 または 100.0超過 の場合は棄却
- **意味**: 極端なスケール変換の検出。負の値は反転を示す

#### 5.3.3 射影成分チェック

- **対象**: H[2,0] および H[2,1]（射影成分）
- **判定**: いずれかの絶対値が 0.01 超過の場合は棄却
- **意味**: 極端な遠近法歪みの検出。平面変換の仮定違反

### 5.4 ワープ変換とブレンディング

#### 5.4.1 座標系変換

最終ホモグラフィ行列の計算:
```
H_to_canvas = Hscale @ H
```
ここで:
- H: クローズアップ → ベース座標系
- Hscale: ベース → キャンバス座標系（スケーリング行列）

#### 5.4.2 ワープ処理

1. `cv.warpPerspective`でクローズアップ画像をキャンバスサイズに変換
2. 同じ変換をマスク画像（全白: 255）に適用

#### 5.4.3 マスク生成

1. 変換されたマスク画像にガウシアンブラーを適用
2. カーネルサイズ: STRENGTH x STRENGTH（奇数に補正）
3. 0-255の値を0.0-1.0の浮動小数点に正規化

#### 5.4.4 アルファブレンディング

計算式:
```
blended = canvas * (1.0 - mask) + warped * mask
```

処理手順:
1. キャンバスとワープ画像をfloat32に変換
2. マスクを3チャンネル（BGR）に拡張
3. 上記式でブレンド計算
4. 結果を0-255にクリップしてuint8に戻す
5. キャンバスをインプレース更新

---

## 6. API仕様

### 6.1 エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | / | Web UIのHTMLを返す |
| POST | /api/upload | 画像ファイルをアップロード |
| POST | /api/stitch | 合成処理を開始 |
| GET | /api/status/{job_id} | ジョブステータスを取得 |
| GET | /api/stream/{job_id} | SSEでリアルタイム進捗を取得 |
| GET | /api/result/{job_id} | 結果画像を取得 |
| GET | /api/download/{job_id} | 結果画像をダウンロード |

### 6.2 POST /api/upload

#### リクエスト

- **Content-Type**: multipart/form-data
- **最大サイズ**: 100MB

| フィールド | 型 | 必須 | 説明 |
|-----------|------|:----:|------|
| overview | File | Yes | 広角画像（1ファイル） |
| closeups | File[] | Yes | クローズアップ画像（複数可） |

#### 許可ファイル形式

- PNG (.png)
- JPEG (.jpg, .jpeg)

#### レスポンス（成功: 200）

```json
{
  "job_id": "uuid-v4-string",
  "overview_count": 1,
  "closeup_count": 5
}
```

#### レスポンス（エラー: 400/500）

```json
{
  "error": "エラーメッセージ"
}
```

### 6.3 POST /api/stitch

#### リクエスト

- **Content-Type**: application/json

```json
{
  "job_id": "uuid-v4-string",
  "params": {
    "canvas_scale": 2,
    "strength": 31,
    "sift_min_matches": 12,
    "sift_ratio_test": 0.75,
    "ransac_threshold": 3.0,
    "use_flann": true,
    "max_features": 5000,
    "downsample_matching": true,
    "downsample_scale": 0.5,
    "use_parallel": true,
    "max_workers": null
  }
}
```

#### パラメータ詳細

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|-------:|------|
| canvas_scale | int | 2 | 出力倍率 (1-5) |
| strength | int | 31 | ブレンド強度 (11-71, 奇数) |
| sift_min_matches | int | 12 | 最小マッチ数 (8-30) |
| sift_ratio_test | float | 0.75 | ratio test閾値 |
| ransac_threshold | float | 3.0 | RANSAC閾値 |
| use_flann | bool | true | FLANNマッチャー使用 |
| max_features | int | 5000 | 最大特徴点数 |
| downsample_matching | bool | true | ダウンサンプリング有効 |
| downsample_scale | float | 0.5 | ダウンサンプリング倍率 |
| use_parallel | bool | true | 並列処理有効 |
| max_workers | int/null | null | ワーカー数 |

#### レスポンス（成功: 200）

```json
{
  "status": "started",
  "job_id": "uuid-v4-string"
}
```

### 6.4 GET /api/status/{job_id}

#### レスポンス（成功: 200）

```json
{
  "job_id": "uuid-v4-string",
  "status": "processing",
  "progress": 45,
  "logs": [
    {
      "timestamp": "2025-12-12T10:30:00.000Z",
      "message": "Processing closeup_001.jpg"
    }
  ]
}
```

#### ステータス値

| 値 | 説明 |
|------|------|
| uploaded | アップロード完了、処理待ち |
| processing | 処理中 |
| completed | 処理完了 |
| failed | エラー発生 |

### 6.5 GET /api/stream/{job_id}

Server-Sent Events (SSE) によるリアルタイム更新

#### イベント形式

```
data: {"type": "log", "data": {"timestamp": "...", "message": "..."}}

data: {"type": "progress", "data": {"progress": 45, "status": "processing"}}

data: {"type": "complete", "data": {"success_count": 10, "skip_count": 2, "total_closeups": 12}}

data: {"type": "error", "data": {"error": "エラーメッセージ"}}
```

#### ポーリング間隔

0.5秒

### 6.6 GET /api/result/{job_id}

#### レスポンス（成功: 200）

- **Content-Type**: image/png
- **Body**: 合成結果画像のバイナリ

### 6.7 GET /api/download/{job_id}

#### レスポンス（成功: 200）

- **Content-Type**: image/png
- **Content-Disposition**: attachment; filename="stitched_result.png"
- **Body**: 合成結果画像のバイナリ

---

## 7. Web UI仕様

### 7.1 画面構成

```
┌─────────────────────────────────────────────────────────────┐
│                    ヘッダー                                  │
│  タイトル: SIFT Image Stitching Tool                        │
│  サブタイトル: 高解像度クローズアップ画像を広角画像に合成     │
└─────────────────────────────────────────────────────────────┘
┌───────────────────────────┬─────────────────────────────────┐
│      左パネル              │         右パネル                │
│                           │                                 │
│  ┌───────────────────┐   │  ┌───────────────────────────┐ │
│  │ Step1: 広角画像    │   │  │ 処理状況パネル（非表示）   │ │
│  │ ドロップゾーン     │   │  │ - 進捗バー                │ │
│  │ プレビュー領域     │   │  │ - ステータスバッジ        │ │
│  └───────────────────┘   │  │ - ログコンテナ            │ │
│                           │  └───────────────────────────┘ │
│  ┌───────────────────┐   │                                 │
│  │ Step2: クローズ    │   │  ┌───────────────────────────┐ │
│  │ アップ画像群       │   │  │ 結果パネル（非表示）       │ │
│  │ ドロップゾーン     │   │  │ - 統計表示                │ │
│  │ グリッドプレビュー │   │  │ - 結果画像プレビュー      │ │
│  └───────────────────┘   │  │ - ダウンロードボタン      │ │
│                           │  └───────────────────────────┘ │
│  ┌───────────────────┐   │                                 │
│  │ Step3: パラメータ  │   │  ┌───────────────────────────┐ │
│  │ - Canvas Scale     │   │  │ 使い方パネル              │ │
│  │ - Blend Strength   │   │  │ 1-4のステップ説明         │ │
│  │ - SIFT Min Matches │   │  └───────────────────────────┘ │
│  │ ▼ 高速化設定       │   │                                 │
│  └───────────────────┘   │                                 │
│                           │                                 │
│  [     合成を開始     ]   │                                 │
│                           │                                 │
└───────────────────────────┴─────────────────────────────────┘
```

### 7.2 UI要素仕様

#### 7.2.1 ドロップゾーン

| プロパティ | 値 |
|-----------|------|
| ボーダー | 2px dashed #cbd5e0 |
| ホバー/ドラッグ時 | ボーダー色: #4299e1, 背景色: #ebf8ff |
| 入力形式 | クリックまたはドラッグ&ドロップ |

#### 7.2.2 プレビュー画像

| プロパティ | 値 |
|-----------|------|
| 最大幅 | 150px |
| 最大高さ | 150px |
| フィット方式 | object-fit: cover |

#### 7.2.3 パラメータスライダー

| パラメータ | 入力タイプ | min | max | step | デフォルト |
|-----------|----------|----:|----:|-----:|---------:|
| Canvas Scale | range | 1 | 5 | 1 | 2 |
| Blend Strength | range | 11 | 71 | 2 | 31 |
| SIFT Min Matches | range | 8 | 30 | 1 | 12 |
| Max Features | range | 1000 | 10000 | 500 | 5000 |
| Downsample Scale | range | 0.3 | 1.0 | 0.1 | 0.5 |
| Max Workers | number | 1 | 16 | 1 | (空欄=auto) |

#### 7.2.4 チェックボックス

| 項目 | デフォルト |
|------|:--------:|
| FLANNマッチャーを使用 | ON |
| マッチング時にダウンサンプリング | ON |
| 並列処理を使用 | ON |

#### 7.2.5 ステータスバッジ

| ステータス | 背景色 | 文字色 | アニメーション |
|-----------|--------|--------|--------------|
| 待機中 | - | - | なし |
| アップロード中 | #fef3c7 | #92400e | なし |
| 処理中 | #dbeafe | #1e40af | パルス |
| 完了 | #dcfce7 | #166534 | なし |
| エラー | #fee2e2 | #991b1b | なし |

### 7.3 状態管理

フロントエンドの状態オブジェクト構造:

| プロパティ | 型 | 説明 |
|-----------|------|------|
| overviewFile | File/null | 選択された広角画像 |
| closeupFiles | File[] | 選択されたクローズアップ画像配列 |
| jobId | string/null | 現在のジョブID |
| eventSource | EventSource/null | SSE接続オブジェクト |

### 7.4 イベントフロー

```
[ユーザー操作]              [システム応答]
     │                           │
     │ 広角画像ドロップ          │
     ├─────────────────────────►│ FileReader.readAsDataURL()
     │                           │ プレビュー表示
     │                           │ state.overviewFile 更新
     │                           │
     │ クローズアップドロップ    │
     ├─────────────────────────►│ 各画像をプレビュー表示
     │                           │ state.closeupFiles 更新
     │                           │ カウント表示更新
     │                           │
     │ 合成開始ボタン押下        │
     ├─────────────────────────►│ POST /api/upload
     │                           │ POST /api/stitch
     │                           │ EventSource接続開始
     │                           │ 進捗パネル表示
     │                           │
     │                           │ SSEイベント受信
     │                           │ - ログ追加
     │                           │ - 進捗バー更新
     │                           │ - ステータス更新
     │                           │
     │                           │ complete イベント
     │                           │ 結果パネル表示
     │                           │ 統計表示
     │                           │
     │ ダウンロードボタン押下    │
     ├─────────────────────────►│ GET /api/download/{job_id}
     │                           │ ファイルダウンロード
```

---

## 8. 入出力仕様

### 8.1 CLI版入力ファイル

#### 8.1.1 ディレクトリ構造

```
{作業ディレクトリ}/
├── overview.jpg          # 広角画像（必須）
└── closeups/             # クローズアップ画像ディレクトリ（必須）
    ├── closeup_001.jpg   # クローズアップ画像
    ├── closeup_002.jpg
    └── ...
```

#### 8.1.2 ファイルパス（固定値）

| 用途 | パス | 形式 |
|------|------|------|
| 広角画像 | overview.jpg | JPEG |
| クローズアップ | closeups/*.jpg | JPEG (glob) |

### 8.2 CLI版出力ファイル

| ファイル | パス | 説明 |
|---------|------|------|
| 結果画像 | stitched.png | 合成結果（PNG形式） |
| ログファイル | stitch.log | 処理ログ（追記モード） |

### 8.3 Web版ファイル構造

```
{アプリケーションディレクトリ}/
├── uploads/                      # アップロード一時保存
│   └── {job_id}/                # ジョブ別ディレクトリ
│       ├── overview_{filename}  # 広角画像
│       ├── closeup_000_{name}   # クローズアップ（連番プレフィックス）
│       ├── closeup_001_{name}
│       └── ...
└── results/                      # 処理結果保存
    └── {job_id}.png             # 合成結果画像
```

### 8.4 ログフォーマット

#### 8.4.1 開始ログ

```
{YYYY-MM-DD HH:MM:SS} --- Processing Start ---
[CONFIG] USE_FLANN={true/false}, MAX_FEATURES={n}, DOWNSAMPLE_FOR_MATCHING={true/false}, USE_PARALLEL={true/false}, MAX_WORKERS={n/auto}
```

#### 8.4.2 情報ログ

```
[INFO] Loaded overview image: overview.jpg
[INFO] Found {n} closeup images.
[INFO] Canvas created with scale {n}x. Dimensions: {w}x{h}
[INFO] Computed {n} SIFT features from overview image (scale={f})
[INFO] Using parallel processing with {n} workers
[INFO] Processing: {filename}
```

#### 8.4.3 デバッグログ

```
[DEBUG] Found {n} good matches.
[DEBUG] RANSAC inliers: {n}/{total} ({percent}%)
[DEBUG] Not enough features found in closeup image. Found: {n}
[DEBUG] Not enough good matches. Found {n}, required {min}.
[DEBUG] findHomography returned None.
```

#### 8.4.4 警告ログ

```
[WARNING] High condition number: {f}, matrix is ill-conditioned
[WARNING] Abnormal determinant: {f}, extreme scaling detected
[WARNING] Large perspective components: h31={f}, h32={f}
[WARNING] Low inlier ratio {percent}%, rejecting homography
```

#### 8.4.5 処理結果ログ

```
[blend] {filename}
[skip] {filename} : {reason}
```

#### 8.4.6 終了ログ

```
Saved: stitched.png
--- Processing End --- Success: {n}, Skip: {n} ---
```

---

## 9. エラーハンドリング

### 9.1 致命的エラー（プロセス終了）

| エラー条件 | メッセージ | 終了コード |
|-----------|----------|:--------:|
| ログファイル作成失敗 | [CRITICAL ERROR] Failed to open log file: {path}. {error} | 1 |
| SIFT未サポート | [CRITICAL ERROR] SIFT is not available in your OpenCV installation. | 1 |
| 広角画像読み込み失敗 | [ERROR] Overview image not found: {path} | 1 |
| クローズアップ0件 | [ERROR] No closeup images found matching pattern: {pattern} | 1 |
| ベース特徴量計算失敗 | [ERROR] Could not compute SIFT features from overview image. | 1 |
| キャンバスリサイズ失敗 | [ERROR] Failed to resize canvas: {error} | 1 |

### 9.2 回復可能エラー（スキップ）

| エラー条件 | ログ出力 | 動作 |
|-----------|---------|------|
| クローズアップ読み込み失敗 | [skip] {file} : Cannot read image | 次画像へ |
| 特徴量不足 | [DEBUG] Not enough features... | 次画像へ |
| マッチ数不足 | [DEBUG] Not enough good matches... | 次画像へ |
| ホモグラフィ計算失敗 | [DEBUG] findHomography returned None. | 次画像へ |
| 条件数チェック失敗 | [WARNING] High condition number... | 次画像へ |
| 行列式チェック失敗 | [WARNING] Abnormal determinant... | 次画像へ |
| 射影成分チェック失敗 | [WARNING] Large perspective components... | 次画像へ |
| インライア率不足 | [WARNING] Low inlier ratio... | 次画像へ |

### 9.3 Web API エラーレスポンス

| HTTPステータス | 条件 | レスポンス |
|:------------:|------|----------|
| 400 | 広角画像なし | {"error": "Overview image is required"} |
| 400 | クローズアップなし | {"error": "At least one closeup image is required"} |
| 400 | 不正ファイル形式 | {"error": "Invalid overview file type"} |
| 400 | 有効なクローズアップなし | {"error": "No valid closeup images uploaded"} |
| 400 | 不正なジョブID | {"error": "Invalid job ID"} |
| 400 | 処理済みジョブ | {"error": "Job already processing or completed"} |
| 400 | 未完了ジョブ | {"error": "Job not completed yet"} |
| 404 | ジョブ未発見 | {"error": "Job not found"} |
| 404 | 結果ファイル未発見 | {"error": "Result file not found"} |
| 500 | サーバー内部エラー | {"error": "{詳細メッセージ}"} |

---

## 10. ファイル構成

### 10.1 ディレクトリツリー

```
SIFT_Image_Stitching_Tool/
├── src/
│   ├── main.py              # CLI版メインスクリプト
│   └── api.py               # Web APIサーバー
├── web/
│   ├── index.html           # Web UIのHTML
│   └── app.js               # フロントエンドJavaScript
├── portable/
│   └── src/
│       ├── main.py          # ポータブル版メイン
│       └── api.py           # ポータブル版API
├── specs/
│   └── SPECIFICATION.md     # 本仕様書
├── launcher.py              # EXE版エントリーポイント
├── requirements.txt         # 本番依存関係
├── requirements-dev.txt     # 開発依存関係
├── CLAUDE.md               # 開発者向けガイド
├── README.md               # プロジェクト説明
└── DEVELOPMENT.md          # 開発環境セットアップ
```

### 10.2 ファイル役割詳細

| ファイル | 行数目安 | 主要責務 |
|---------|-------:|---------|
| src/main.py | 約500行 | CLI処理フロー、SIFT処理、ブレンディング、ログ出力 |
| src/api.py | 約620行 | Flask REST API、ジョブ管理、SSE配信、画像処理の再実装 |
| web/index.html | 約260行 | UI構造、Tailwind CSSスタイリング |
| web/app.js | 約420行 | 状態管理、API通信、イベントハンドリング |
| launcher.py | 約130行 | リソースパス解決、ブラウザ起動、Flask起動 |

---

## 11. 依存関係

### 11.1 実行時依存関係

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| opencv-contrib-python | >=4.12.0 | SIFT特徴量検出、画像処理、ホモグラフィ計算 |
| numpy | >=2.2.6 | 配列演算、線形代数計算 |
| scipy | >=1.16.3 | 科学計算ライブラリ |
| scikit-image | >=0.25.2 | 画像処理ユーティリティ |
| Flask | >=3.1.2 | Webフレームワーク |
| flask-cors | >=6.0.1 | CORS対応 |

### 11.2 開発時依存関係

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| pyinstaller | >=6.17.0 | EXEビルド |
| pyinstaller-hooks-contrib | >=2025.10 | PyInstallerフック |

### 11.3 フロントエンド依存関係

| ライブラリ | 取得方法 | 用途 |
|-----------|---------|------|
| Tailwind CSS | CDN | UIスタイリング |

---

## 12. 制約事項

### 12.1 システム要件

| 項目 | 最小要件 | 推奨 |
|------|---------|------|
| Python | 3.11以上 | 3.11以上 |
| OS | Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+) | - |
| メモリ | 4GB | 8GB以上 |
| ディスク | 2GB空き | 5GB以上 |

### 12.2 入力画像制約

| 項目 | 制約 |
|------|------|
| サポート形式 | JPEG, PNG |
| アップロード最大サイズ | 100MB（Web版） |
| ファイル名 | 英数字推奨（日本語可だがエスケープ処理される） |

### 12.3 処理制約

| 項目 | 説明 |
|------|------|
| スレッドセーフ | キャンバスへのブレンド処理はメインスレッドで実行 |
| メモリ使用 | CANVAS_SCALE増加に比例してメモリ消費増加 |
| 並列処理 | ThreadPoolExecutorによるスレッドベース並列化 |

### 12.4 精度制約

| 項目 | 閾値 | 影響 |
|------|------|------|
| 最小マッチ数 | 12（デフォルト） | 少なすぎると誤マッチ、多すぎると棄却増加 |
| インライア率 | 10%以上 | 10%未満は品質不足として棄却 |
| 条件数 | 10.0以下 | 超過は数値不安定として棄却 |
| 行列式 | 0.01-100.0 | 範囲外は極端な変換として棄却 |
| 射影成分 | |H[2,0]|, |H[2,1]| < 0.01 | 超過は遠近法歪みとして棄却 |

### 12.5 既知の制限

1. **反射/透明オブジェクト**: SIFT特徴点が不安定になる可能性
2. **低コントラスト画像**: 特徴点検出数が減少
3. **大きな視点変化**: ホモグラフィ推定が失敗しやすい
4. **繰り返しパターン**: 誤マッチングの原因となる

---

## 改訂履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0.0 | 2025-12-12 | 初版作成 |

---

## 用語集

| 用語 | 説明 |
|------|------|
| SIFT | Scale-Invariant Feature Transform。スケールや回転に不変な特徴点検出アルゴリズム |
| ホモグラフィ | 2つの平面間の射影変換を表す3x3行列 |
| RANSAC | Random Sample Consensus。外れ値に頑健なパラメータ推定アルゴリズム |
| Lowe's ratio test | 最近傍と次近傍のマッチ距離比による誤マッチ除去手法 |
| FLANN | Fast Library for Approximate Nearest Neighbors。高速近似最近傍探索ライブラリ |
| SSE | Server-Sent Events。サーバーからクライアントへの単方向リアルタイム通信 |
| BFMatcher | Brute-Force Matcher。総当たりで最近傍を探索するマッチャー |
| インライア | RANSACで推定されたモデルに適合するデータ点 |
| 条件数 | 行列の数値的安定性を示す指標。大きいほど不安定 |
