# テクノロジースタック

## 言語
- **Python**: メイン言語（バージョン指定なし）

## 主要依存ライブラリ

### opencv-python / opencv-contrib-python
- **用途**: 画像処理とSIFT機能
- **主要機能**:
  - SIFT特徴点検出・記述子計算
  - 画像読み込み・保存・リサイズ
  - ホモグラフィ計算（findHomography with RANSAC）
  - 画像ワーピング（warpPerspective）
  - ガウシアンブラー（GaussianBlur）
  - Sobel/Laplacian演算（analyze_stitched.pyで使用）
- **注意**: SIFTには`opencv-contrib-python`が必要な場合あり。コード内に互換性フォールバックロジックあり:
  ```python
  try:
      sift = cv.SIFT_create()
  except AttributeError:
      try:
          sift = cv.xfeatures2d.SIFT_create()
      except AttributeError:
          # エラー終了
  ```

### numpy
- **用途**: 配列演算とホモグラフィ計算
- **主要機能**:
  - 座標変換行列の構築
  - float32配列演算（ブレンディング）
  - 統計計算（min/max/mean/std）

### scikit-image (オプション)
- **用途**: SSIM（構造的類似性）計算のみ（analyze_stitched.pyで使用）
- **ステータス**: メインロジック（src/main.py）では不要

## パッケージ管理
- **形式**: 依存関係管理ファイルなし（requirements.txt、pyproject.toml、setup.pyなど存在しない）
- **インストール方法**: ユーザーが手動で`pip install opencv-contrib-python numpy`などを実行する必要あり

## 標準ライブラリ使用
- `glob`: クローズアップ画像のファイルパスマッチング
- `sys`: エラー時の終了処理
- `datetime`: ログタイムスタンプ
- `os`: ファイル名取得（os.path.basename）
- `pathlib`: analyze_stitched.pyでのパス操作
- `json`: analyze_stitched.pyでのレポート出力

## 開発環境
- **OS**: Windows
  - コード内にOS依存の処理はないが、実行環境として想定
  - パス区切りはWindowsスタイル（バックスラッシュ）も対応
- **エディタ/IDE**: 指定なし（.vscode/や.idea/など存在しない）
