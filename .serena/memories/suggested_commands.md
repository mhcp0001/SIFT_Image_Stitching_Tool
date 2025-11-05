# 推奨コマンド

## 実行環境
- **OS**: Windows
- **作業ディレクトリ**: リポジトリルート (`C:\Users\71532412\workspace\SIFT_Image_Stitching_Tool`)

## メイン実行コマンド

### 画像合成ツールの実行
```bash
python src/main.py
```

**前提条件**:
- オーバービュー画像が `img/overview.jpg` に存在すること
- クローズアップ画像が `img/closeups/*.jpg` に1枚以上存在すること

**出力**:
- `img/stitched.png`: 合成結果画像
- `img/stitch.log`: 処理ログ（追記モード）

**注意**:
- リポジトリルートから実行する必要がある（相対パスがハードコード）
- `img/`ディレクトリは`.gitignore`で除外されているため、Git管理外

### 結果分析ツールの実行
```bash
python tools/analyze_stitched.py
```

**前提条件**:
- `img/stitched.png` が存在すること（メイン実行後）

**出力**:
- `img/stitched_report.json`: 詳細メトリクス（寸法、チャンネル統計、鮮明度、PSNR/SSIM）
- `img/stitched_thumb.jpg`: サムネイル画像（最大1200px）
- `img/stitched_seam_heatmap.jpg`: シーム品質可視化用Sobelグラディエントヒートマップ

## 依存関係インストール

### 必須ライブラリのインストール
```bash
pip install opencv-contrib-python numpy
```

**注意**: `opencv-python`ではなく`opencv-contrib-python`を推奨（SIFT機能含む）

### オプション（分析ツール用）
```bash
pip install scikit-image
```

**用途**: SSIM計算のみ（なくてもメイン処理は動作）

## 開発用コマンド

### ディレクトリ構造確認（Windows）
```bash
tree /F
```

または

```bash
dir /S
```

### ファイル検索（Windows）
```bash
where /R . *.py
```

### ログファイル確認
```bash
type img\stitch.log
```

または

```bash
more img\stitch.log
```

## Git操作

### 現在の状態確認
```bash
git status
```

### 変更の確認
```bash
git diff
```

### コミット
```bash
git add src/main.py
git commit -m "説明メッセージ"
```

**注意**: `img/`ディレクトリは`.gitignore`で除外されているため、入出力画像はコミットされない

## テスト・リント・フォーマット

現時点でプロジェクトには以下が存在しない:
- ユニットテスト（`pytest`など）
- リンター設定（`flake8`, `pylint`, `ruff`など）
- フォーマッター設定（`black`, `autopep8`など）
- 型チェック（`mypy`など）

**推奨**: コード変更後は実際にツールを実行して動作確認すること

## トラブルシューティング

### SIFTが使用できない場合
```bash
pip uninstall opencv-python
pip install opencv-contrib-python
```

### 画像が見つからない場合
- `img/`ディレクトリの存在確認: `dir img`
- オーバービュー画像の確認: `dir img\overview.jpg`
- クローズアップ画像の確認: `dir img\closeups\*.jpg`

### ログ確認（最新20行）
```bash
powershell -command "Get-Content img\stitch.log -Tail 20"
```

## Windows固有の注意事項

- **パス区切り**: バックスラッシュ（`\`）を使用
- **ディレクトリリスト**: `ls`の代わりに`dir`
- **ファイル内容表示**: `cat`の代わりに`type`
- **検索**: `grep`の代わりに`findstr`（または`Select-String`をPowerShellで使用）
