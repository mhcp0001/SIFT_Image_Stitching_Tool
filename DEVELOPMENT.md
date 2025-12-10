# 開発環境セットアップガイド

このドキュメントでは、SIFT Image Stitching Toolの開発環境を新しい端末で構築する手順を説明します。

## 📋 必要条件

### システム要件

- **OS**: Windows 10/11, macOS 10.15+, または Linux (Ubuntu 20.04+推奨)
- **Python**: 3.11以上
- **メモリ**: 4GB以上推奨
- **ディスク容量**: 2GB以上の空き容量

### 事前準備

1. **Pythonのインストール**
   - [Python公式サイト](https://www.python.org/downloads/)から最新版をダウンロード
   - インストール時に「Add Python to PATH」を必ずチェック
   - バージョン確認: `python --version` (3.11以上であることを確認)

2. **Gitのインストール** (リポジトリをクローンする場合)
   - [Git公式サイト](https://git-scm.com/)からダウンロード

## 🚀 クイックスタート

### 自動セットアップ (推奨)

#### Windows

```cmd
# リポジトリをクローン
git clone <repository-url>
cd SIFT_Image_Stitching_Tool

# セットアップスクリプトを実行
setup_dev.bat
```

#### macOS / Linux

```bash
# リポジトリをクローン
git clone <repository-url>
cd SIFT_Image_Stitching_Tool

# セットアップスクリプトに実行権限を付与
chmod +x setup_dev.sh

# セットアップスクリプトを実行
./setup_dev.sh
```

セットアップスクリプトは以下を自動的に実行します：
- Pythonバージョンの確認
- 仮想環境の作成とアクティベート
- pipのアップグレード
- 依存パッケージのインストール
- 必要なディレクトリの作成

### 手動セットアップ

自動セットアップがうまくいかない場合は、以下の手順で手動セットアップできます。

#### 1. 仮想環境の作成

```bash
# 仮想環境を作成
python -m venv venv

# 仮想環境をアクティベート
# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate
```

#### 2. 依存パッケージのインストール

```bash
# pipをアップグレード
python -m pip install --upgrade pip

# 本番環境の依存関係のみ
pip install -r requirements.txt

# 開発環境の依存関係も含む
pip install -r requirements-dev.txt
```

#### 3. 必要なディレクトリの作成

```bash
# Windows:
mkdir uploads
mkdir results

# macOS/Linux:
mkdir -p uploads results
```

## 📦 依存関係について

### requirements.txt (本番環境)

アプリケーション実行に必要な最小限のパッケージ：

- **opencv-contrib-python** (4.12.0): SIFT特徴量検出
- **numpy** (2.2.6): 数値計算
- **scipy** (1.16.3): 科学計算
- **scikit-image** (0.25.2): 画像処理
- **Flask** (3.1.2): Webフレームワーク
- **flask-cors** (6.0.1): CORS対応

### requirements-dev.txt (開発環境)

開発・ビルドに必要な追加パッケージ：

- **pyinstaller** (6.17.0): EXEビルド
- **pyinstaller-hooks-contrib** (2025.10): PyInstallerフック

オプション（コメントアウト済み）：
- **flake8**: コード品質チェック
- **black**: コードフォーマッター
- **isort**: import文整理
- **pytest**: テストフレームワーク
- **ipython**: インタラクティブシェル

## 🔧 開発作業の流れ

### 1. 開発サーバーの起動

```bash
# 仮想環境をアクティベート（まだの場合）
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# 開発サーバーを起動
python src/api.py

# ブラウザで以下を開く
# http://127.0.0.1:5000
```

### 2. コード変更

- `src/` - バックエンドコード (Python)
- `web/` - フロントエンドコード (HTML/JS)

Flaskはデバッグモードで起動するため、ファイルを編集すると自動的に再読み込みされます。

### 3. EXEビルド

```bash
# Windows:
build_exe.bat

# macOS/Linux:
pyinstaller SIFT_Stitcher.spec

# 生成されたファイル:
# dist/SIFT_Stitcher.exe (Windows)
# dist/SIFT_Stitcher (macOS/Linux)
```

### 4. ポータブル版ビルド

```bash
# Windows:
build_portable.bat

# 生成されたフォルダ:
# portable/
```

## 🧪 テストとコード品質

### コード品質チェック（flake8有効化時）

```bash
# requirements-dev.txt でflake8のコメントを解除してから
pip install flake8

# 静的解析実行
flake8 src/ launcher.py
```

### コードフォーマット（black有効化時）

```bash
pip install black isort

# コードフォーマット
black src/ launcher.py

# import文整理
isort src/ launcher.py
```

### テスト実行（pytest有効化時）

```bash
pip install pytest pytest-cov

# テスト実行
pytest tests/

# カバレッジ付き
pytest --cov=src tests/
```

## 🐛 トラブルシューティング

### Python バージョンエラー

```
エラー: Python 3.11以上が必要です
```

**解決策**: Python 3.11以降をインストールしてください。

### 仮想環境のアクティベートエラー (Windows)

```
このシステムではスクリプトの実行が無効になっているため...
```

**解決策**: PowerShellを管理者権限で開き、以下を実行：

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### OpenCVインストールエラー

```
ERROR: Could not build wheels for opencv-contrib-python
```

**解決策**:
1. Visual C++ 再頒布可能パッケージをインストール
2. または事前ビルド版を使用: `pip install opencv-contrib-python --only-binary opencv-contrib-python`

### ポート5000が使用中

```
OSError: [Errno 48] Address already in use
```

**解決策**:
1. 別のアプリケーションがポート5000を使用中
2. プロセスを終了するか、`src/api.py` のポート番号を変更

## 📝 推奨ワークフロー

### 新機能開発

1. **ブランチ作成**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **開発**
   - コードを編集
   - 開発サーバーでテスト

3. **コミット**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

4. **プッシュ**
   ```bash
   git push origin feature/new-feature
   ```

### リリース準備

1. **バージョン更新**
   - READMEのバージョン番号を更新

2. **EXEビルド**
   ```bash
   build_exe.bat
   ```

3. **動作確認**
   - dist/SIFT_Stitcher.exe を実行
   - すべての機能をテスト

4. **リリースタグ**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

## 🔗 関連ドキュメント

- [README.md](README.md) - プロジェクト概要と使い方
- [CLAUDE.md](CLAUDE.md) - Claude Code用のプロジェクトガイド
- [README_PORTABLE.txt](portable/README_PORTABLE.txt) - ポータブル版の使い方
- [README_EXE.txt](README_EXE.txt) - EXE版の使い方

## 💡 ヒント

### VSCode推奨設定

`.vscode/settings.json`:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true
}
```

### よく使うコマンド

```bash
# 仮想環境のアクティベート
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# 依存関係の更新
pip install -r requirements-dev.txt --upgrade

# インストール済みパッケージの確認
pip list

# 依存関係の固定（バージョン指定）
pip freeze > requirements-freeze.txt

# 開発サーバー起動
python src/api.py

# EXEビルド
build_exe.bat  # Windows
pyinstaller SIFT_Stitcher.spec  # macOS/Linux
```

## 📞 サポート

問題が発生した場合は、GitHubのIssuesで報告してください。

---

最終更新: 2025-12-10
