@echo off
chcp 65001 > nul
echo ========================================
echo SIFT Image Stitching Tool - ポータブル版
echo ========================================
echo.

cd /d "%~dp0"

REM セットアップ確認
if not exist "python_embed\python.exe" (
    echo エラー: Python埋め込み版が見つかりません。
    echo 先に setup_portable.bat を実行してください。
    echo.
    pause
    exit /b 1
)

if not exist "src\api.py" (
    echo エラー: アプリケーションファイルが見つかりません。
    echo src フォルダが正しく配置されているか確認してください。
    echo.
    pause
    exit /b 1
)

echo Pythonバージョン:
python_embed\python.exe --version
echo.

echo Flask開発サーバーを起動しています...
echo ブラウザで以下のURLを開いてください:
echo.
echo     http://127.0.0.1:5000
echo.
echo 終了するには Ctrl+C を押してください
echo.
echo ========================================
echo.

REM APIサーバーを起動
python_embed\python.exe src\api.py

if errorlevel 1 (
    echo.
    echo エラー: サーバーの起動に失敗しました。
    echo.
    pause
)
