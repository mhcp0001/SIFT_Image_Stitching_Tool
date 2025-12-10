#!/bin/bash

echo "========================================"
echo "SIFT Image Stitching Tool"
echo "開発環境セットアップスクリプト (Linux/macOS)"
echo "========================================"
echo ""

# エラーが発生したら即座に終了
set -e

# スクリプトのディレクトリに移動
cd "$(dirname "$0")"

# Python バージョンチェック
echo "[1/6] Python環境を確認しています..."
if ! command -v python3 &> /dev/null; then
    echo "エラー: Python3が見つかりません"
    echo "Python 3.11以上をインストールしてください"
    exit 1
fi

python3 --version
echo ""

# Python バージョンの詳細チェック
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    echo "エラー: Python 3.11以上が必要です"
    python3 --version
    exit 1
fi

# 仮想環境の確認
echo "[2/6] 仮想環境を確認しています..."
if [ -d "venv" ]; then
    echo "既存の仮想環境が見つかりました: venv"
    read -p "既存の環境を使用しますか？ (Y/n): " USE_EXISTING
    if [ "$USE_EXISTING" = "n" ] || [ "$USE_EXISTING" = "N" ]; then
        echo "既存の仮想環境を削除しています..."
        rm -rf venv
    else
        echo "既存の仮想環境を使用します"
        source venv/bin/activate
        echo ""
        # pipアップグレードにスキップ
        SKIP_VENV_CREATE=true
    fi
fi

# 仮想環境の作成
if [ "$SKIP_VENV_CREATE" != "true" ]; then
    echo "仮想環境を作成しています..."
    python3 -m venv venv
    echo "仮想環境の作成が完了しました"
    echo ""

    echo "[3/6] 仮想環境をアクティベートしています..."
    source venv/bin/activate
    echo ""

    # pipのアップグレード
    echo "[4/6] pipをアップグレードしています..."
    python -m pip install --upgrade pip
    echo ""
fi

# 依存パッケージのインストール
echo "[5/6] 依存パッケージをインストールしています..."
echo "この処理には数分かかる場合があります..."
echo ""

# インストールモードの選択
echo "インストールモード:"
echo "[1] 最小構成（PyInstallerのみ）"
echo "[2] 完全構成（全ての開発ツール）"
echo ""
read -p "選択 (1/2): " INSTALL_MODE

if [ "$INSTALL_MODE" = "2" ]; then
    echo "完全構成でインストールしています..."
    pip install -r requirements.txt
    pip install pyinstaller==6.17.0 pyinstaller-hooks-contrib==2025.10
    pip install flake8 black isort pytest pytest-cov ipython
else
    echo "最小構成でインストールしています..."
    pip install -r requirements-dev.txt
fi

echo ""
echo "[6/6] 必要なディレクトリを作成しています..."
mkdir -p uploads results
echo ""

# 環境情報の表示
echo "========================================"
echo "セットアップ完了！"
echo "========================================"
echo ""
echo "Python環境:"
python --version
echo ""
echo "インストール済みパッケージ（主要なもの）:"
pip list | grep -iE "opencv|numpy|flask|pyinstaller"
echo ""
echo "次のステップ:"
echo ""
echo "  開発サーバー起動:"
echo "    source venv/bin/activate"
echo "    python src/api.py"
echo ""
echo "  EXEビルド (macOSの場合はappファイル):"
echo "    source venv/bin/activate"
echo "    pyinstaller SIFT_Stitcher.spec"
echo ""
echo "  仮想環境のアクティベート:"
echo "    source venv/bin/activate"
echo ""
echo "  仮想環境の終了:"
echo "    deactivate"
echo ""
