@echo off
chcp 65001 > nul
echo ========================================
echo SIFT Image Stitching Tool
echo 開発環境セットアップスクリプト (Windows)
echo ========================================
echo.

cd /d "%~dp0"

REM Python バージョンチェック
echo [1/6] Python環境を確認しています...
python --version > nul 2>&1
if errorlevel 1 (
    echo エラー: Pythonが見つかりません
    echo Python 3.11以上をインストールしてください
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

python --version
echo.

REM Python バージョンの詳細チェック
python -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
    echo エラー: Python 3.11以上が必要です
    python --version
    pause
    exit /b 1
)

REM 仮想環境の確認
echo [2/6] 仮想環境を確認しています...
if exist venv (
    echo 既存の仮想環境が見つかりました: venv
    echo 既存の環境を使用しますか？ ^(Y/N^)
    set /p USE_EXISTING="選択: "
    if /i "%USE_EXISTING%"=="N" (
        echo 既存の仮想環境を削除しています...
        rmdir /s /q venv
        goto :create_venv
    )
    echo 既存の仮想環境を使用します
    goto :activate_venv
)

:create_venv
echo 仮想環境を作成しています...
python -m venv venv
if errorlevel 1 (
    echo エラー: 仮想環境の作成に失敗しました
    pause
    exit /b 1
)
echo 仮想環境の作成が完了しました
echo.

:activate_venv
echo [3/6] 仮想環境をアクティベートしています...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo エラー: 仮想環境のアクティベートに失敗しました
    pause
    exit /b 1
)
echo.

REM pipのアップグレード
echo [4/6] pipをアップグレードしています...
python -m pip install --upgrade pip
echo.

REM 開発環境のインストール
echo [5/6] 依存パッケージをインストールしています...
echo この処理には数分かかる場合があります...
echo.

REM インストールモードの選択
echo インストールモード:
echo [1] 最小構成（PyInstallerのみ）
echo [2] 完全構成（全ての開発ツール）
echo.
set /p INSTALL_MODE="選択 (1/2): "

if "%INSTALL_MODE%"=="2" (
    echo 完全構成でインストールしています...
    REM requirements-dev.txtを編集して全てのコメントを解除
    pip install -r requirements.txt
    pip install pyinstaller==6.17.0 pyinstaller-hooks-contrib==2025.10
    pip install flake8 black isort pytest pytest-cov ipython
) else (
    echo 最小構成でインストールしています...
    pip install -r requirements-dev.txt
)

if errorlevel 1 (
    echo.
    echo エラー: パッケージのインストールに失敗しました
    echo インターネット接続を確認してください
    pause
    exit /b 1
)

echo.
echo [6/6] 必要なディレクトリを作成しています...
if not exist uploads mkdir uploads
if not exist results mkdir results
echo.

REM 環境情報の表示
echo ========================================
echo セットアップ完了！
echo ========================================
echo.
echo Python環境:
python --version
echo.
echo インストール済みパッケージ（主要なもの）:
pip list | findstr /i "opencv numpy flask pyinstaller"
echo.
echo 次のステップ:
echo.
echo  開発サーバー起動:
echo    venv\Scripts\activate
echo    python src/api.py
echo.
echo  EXEビルド:
echo    venv\Scripts\activate
echo    build_exe.bat
echo.
echo  仮想環境のアクティベート:
echo    venv\Scripts\activate
echo.
echo  仮想環境の終了:
echo    deactivate
echo.
pause
