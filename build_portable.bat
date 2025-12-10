@echo off
chcp 65001 > nul
echo ========================================
echo SIFT Image Stitching Tool
echo ポータブル版ビルドスクリプト
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] portableディレクトリを準備しています...
if not exist portable mkdir portable
if not exist portable\uploads mkdir portable\uploads
if not exist portable\results mkdir portable\results
echo.

echo [2/4] アプリケーションファイルをコピーしています...

REM srcディレクトリをコピー
if exist portable\src rmdir /s /q portable\src
xcopy /E /I /Y src portable\src > nul
echo - src/ をコピーしました

REM webディレクトリをコピー
if exist portable\web rmdir /s /q portable\web
xcopy /E /I /Y web portable\web > nul
echo - web/ をコピーしました

REM requirements.txtをコピー
copy /Y requirements.txt portable\ > nul
echo - requirements.txt をコピーしました

echo.
echo [3/4] 不要なファイルをクリーンアップしています...

REM __pycache__を削除
for /d /r portable\src %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"

REM .pycファイルを削除
del /s /q portable\src\*.pyc 2>nul

echo クリーンアップが完了しました。
echo.

echo [4/4] ポータブル版のファイル構成を確認しています...
echo.
echo ポータブル版の内容:
dir /B portable
echo.

echo ========================================
echo ビルドが完了しました！
echo ========================================
echo.
echo 次の手順:
echo 1. portable フォルダを配布したい場所にコピー
echo 2. ユーザーに setup_portable.bat を実行してもらう
echo 3. その後 start_portable.bat で起動
echo.
echo ポータブル版フォルダのサイズ:
powershell -Command "'{0:N2} MB' -f ((Get-ChildItem -Path portable -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB)"
echo.
pause
