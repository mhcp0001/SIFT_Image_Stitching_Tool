# SIFT Image Stitching Tool

高解像度クローズアップ画像を広角画像に合成するツール（Web UI対応）

## 概要

このツールは、OpenCVのSIFT（Scale-Invariant Feature Transform）アルゴリズムを使用して、複数の高解像度クローズアップ画像を1枚の広角画像（Overview）に合成します。

**主な特徴:**
- SIFT特徴点マッチングによる高精度な画像合成
- ガウシアンブラーマスクによる滑らかなブレンディング
- ホモグラフィ検証による品質保証
- **Web UI対応** - ブラウザから直感的に操作可能
- リアルタイム処理進捗表示

## アーキテクチャ

### コマンドライン版（従来）
```
python src/main.py
```

### Web UI版（新機能）
```
python src/api.py
```

## セットアップ

### 1. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 2. 必要なパッケージ
- opencv-contrib-python（SIFT機能を含む）
- numpy
- Flask（Web UI用）
- Flask-CORS（Web UI用）

## 使い方

### Web UI版（推奨）

#### 1. サーバーの起動

```bash
cd C:\Users\nestl\workspace\SIFT_Image_Stitching_Tool
python src/api.py
```

サーバーが起動したら、ブラウザで以下にアクセス:
```
http://localhost:5000
```

#### 2. 画像の準備

- **広角画像（Overview）**: 全体を写した1枚の画像
- **クローズアップ画像群（Closeups）**: 高解像度で撮影した複数の詳細画像

#### 3. Web UIでの操作手順

1. **広角画像をアップロード**
   - ドラッグ&ドロップまたはクリックして画像を選択

2. **クローズアップ画像群をアップロード**
   - 複数の画像を一度に選択可能

3. **パラメータ調整（オプション）**
   - **Canvas Scale**: 出力画像の倍率（1-5倍）
   - **Blend Strength**: ブレンディングの滑らかさ（11-71）
   - **SIFT Min Matches**: 必要な最小特徴点マッチ数（8-30）

4. **合成を開始**
   - 処理進捗がリアルタイムで表示されます
   - 完了後、結果画像をダウンロード可能

### コマンドライン版

#### ファイル配置

```
SIFT_Image_Stitching_Tool/
├── img/
│   ├── overview.jpg          # 広角画像
│   └── closeups/
│       ├── closeup_001.jpg   # クローズアップ画像
│       ├── closeup_002.jpg
│       └── ...
```

#### 実行

```bash
cd C:\Users\nestl\workspace\SIFT_Image_Stitching_Tool
python src/main.py
```

#### 出力

- `img/stitched.png` - 合成結果画像
- `img/stitch.log` - 処理ログ

## パラメータ詳細

### Canvas Scale（出力倍率）
- **デフォルト**: 2倍
- **範囲**: 1-5倍
- **説明**: 広角画像を何倍に拡大して出力するか
- **推奨**: 高解像度出力が必要な場合は3倍以上

### Blend Strength（ブレンド強度）
- **デフォルト**: 31
- **範囲**: 11-71（奇数のみ）
- **説明**: ガウシアンブラーのカーネルサイズ
- **推奨**:
  - 小さい値（11-21）: シャープな境界、処理高速
  - 大きい値（41-71）: 滑らかな境界、ゴースト発生の可能性

### SIFT Min Matches（最小マッチ数）
- **デフォルト**: 12
- **範囲**: 8-30
- **説明**: ホモグラフィ計算に必要な最小特徴点数
- **推奨**:
  - 小さい値（8-12）: より多くの画像を採用（精度低下リスク）
  - 大きい値（15-30）: 高品質な画像のみ採用（棄却増加）

## API エンドポイント（開発者向け）

### POST /api/upload
画像をアップロード

**リクエスト:**
- `overview`: 広角画像（multipart/form-data）
- `closeups`: クローズアップ画像群（multipart/form-data）

**レスポンス:**
```json
{
  "job_id": "uuid",
  "overview_count": 1,
  "closeup_count": 5
}
```

### POST /api/stitch
合成処理を開始

**リクエスト:**
```json
{
  "job_id": "uuid",
  "params": {
    "canvas_scale": 2,
    "strength": 31,
    "sift_min_matches": 12
  }
}
```

### GET /api/status/{job_id}
処理状況を取得

### GET /api/stream/{job_id}
Server-Sent Eventsでリアルタイム進捗を取得

### GET /api/result/{job_id}
結果画像を取得

### GET /api/download/{job_id}
結果画像をダウンロード

## トラブルシューティング

### SIFT が利用できない
```
[CRITICAL ERROR] SIFT is not available
```

**解決策:**
```bash
pip uninstall opencv-python
pip install opencv-contrib-python
```

### マッチング失敗が多い

**原因:**
- 画像間の類似性が低い
- クローズアップの撮影位置が広角画像と異なりすぎる

**解決策:**
- SIFT Min Matchesを減らす（8-10に設定）
- より類似した画像を使用する

### ブレンド境界が目立つ

**解決策:**
- Blend Strengthを増やす（41-51に設定）

## ディレクトリ構造

```
SIFT_Image_Stitching_Tool/
├── src/
│   ├── main.py              # コマンドライン版メインスクリプト
│   └── api.py               # Web API サーバー
├── web/
│   ├── index.html           # Web UI
│   └── app.js               # フロントエンドロジック
├── img/                     # 画像入出力ディレクトリ（CLI版）
├── uploads/                 # アップロード一時ディレクトリ（Web版）
├── results/                 # 結果出力ディレクトリ（Web版）
├── tools/
│   └── analyze_stitched.py  # 結果分析ツール
├── requirements.txt         # Python依存関係
├── CLAUDE.md               # 開発者向けドキュメント
└── README.md               # このファイル
```

## 技術詳細

### SIFT特徴点マッチング
1. 広角画像とクローズアップ画像からSIFT特徴点を抽出
2. BFMatcher（Brute-Force Matcher）でマッチング
3. Lowe's ratio test（0.75）で良好なマッチを選別
4. RANSAC（閾値3.0）でホモグラフィ行列を推定

### ホモグラフィ検証
- 条件数（Condition Number）< 10.0
- 行列式（Determinant）が0.01 - 100.0の範囲
- 射影成分（h31, h32）< 0.01

### ブレンディング
- ガウシアンブラーマスクでエッジを滑らかに
- アルファブレンディング: `blended = canvas * (1 - mask) + warped * mask`
- float32精度で計算後、uint8にクリップ

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 参考文献

- [PTGui - Professional Panorama Software](https://www.ptgui.com/)
- [OpenCV SIFT Documentation](https://docs.opencv.org/4.x/da/df5/tutorial_py_sift_intro.html)
- [Image Stitching with OpenCV](https://docs.opencv.org/4.x/d8/d19/tutorial_stitcher.html)
