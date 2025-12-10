@echo off
chcp 65001 > nul
echo ========================================
echo SIFT Image Stitching Tool
echo PyInstaller EXEビルドスクリプト
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 環境を確認しています...
python --version
if errorlevel 1 (
    echo エラー: Pythonが見つかりません
    pause
    exit /b 1
)

echo.
echo PyInstallerのバージョン:
python -m PyInstaller --version
if errorlevel 1 (
    echo エラー: PyInstallerがインストールされていません
    echo pip install pyinstaller を実行してください
    pause
    exit /b 1
)

echo.
echo [2/4] 以前のビルドをクリーンアップしています...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
echo クリーンアップ完了

echo.
echo [3/4] PyInstallerでEXEをビルドしています...
echo この処理には数分かかる場合があります...
echo.

python -m PyInstaller SIFT_Stitcher.spec

if errorlevel 1 (
    echo.
    echo エラー: ビルドに失敗しました
    echo ログを確認してください
    pause
    exit /b 1
)

echo.
echo [4/4] ビルド結果を確認しています...
echo.

if exist dist\SIFT_Stitcher.exe (
    echo ========================================
    echo ビルド成功！
    echo ========================================
    echo.
    echo 実行ファイルの場所:
    echo %cd%\dist\SIFT_Stitcher.exe
    echo.

    REM ファイルサイズを表示
    echo ファイルサイズ:
    powershell -Command "'{0:N2} MB' -f ((Get-Item 'dist\SIFT_Stitcher.exe').Length / 1MB)"
    echo.

    echo 使い方:
    echo 1. dist\SIFT_Stitcher.exe をダブルクリックして起動
    echo 2. ブラウザが自動的に開きます
    echo 3. 開かない場合は手動で http://127.0.0.1:5000 を開く
    echo.
    echo 注意:
    echo - 初回起動時は展開処理のため少し時間がかかります
    echo - exe と同じフォルダに uploads/ と results/ が作成されます
    echo.
) else (
    echo エラー: SIFT_Stitcher.exe が見つかりません
    echo ビルドが失敗した可能性があります
    pause
    exit /b 1
)

pause
