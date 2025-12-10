@echo off
chcp 65001 > nul
echo ========================================
echo SIFT Image Stitching Tool - ポータブル版
echo 初回セットアップ
echo ========================================
echo.

cd /d "%~dp0"

REM Python埋め込み版のバージョン設定
set PYTHON_VERSION=3.11.9
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip
set PYTHON_DIR=python_embed

echo [1/5] Python埋め込み版の確認中...
if exist "%PYTHON_DIR%\python.exe" (
    echo Python埋め込み版は既にインストールされています。
    goto :install_pip
)

echo Python埋め込み版をダウンロードしています...
echo URL: %PYTHON_URL%
echo.

REM PowerShellでダウンロード
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile 'python_embed.zip'}"

if not exist python_embed.zip (
    echo エラー: Pythonのダウンロードに失敗しました。
    echo 手動でダウンロードしてください: %PYTHON_URL%
    pause
    exit /b 1
)

echo Pythonを展開しています...
powershell -Command "Expand-Archive -Path 'python_embed.zip' -DestinationPath '%PYTHON_DIR%' -Force"
del python_embed.zip
echo Python埋め込み版のインストールが完了しました。
echo.

:install_pip
echo [2/5] pipのインストール確認中...
if exist "%PYTHON_DIR%\Scripts\pip.exe" (
    echo pipは既にインストールされています。
    goto :enable_site_packages
)

echo pipをダウンロードしています...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py'}"

if not exist get-pip.py (
    echo エラー: get-pip.pyのダウンロードに失敗しました。
    pause
    exit /b 1
)

echo pipをインストールしています...
%PYTHON_DIR%\python.exe get-pip.py
del get-pip.py
echo pipのインストールが完了しました。
echo.

:enable_site_packages
echo [3/5] site-packagesを有効化しています...
REM python311._pthファイルを編集してsite-packagesを有効化
for %%f in (%PYTHON_DIR%\python*._pth) do (
    findstr /C:"#import site" "%%f" > nul
    if not errorlevel 1 (
        powershell -Command "(Get-Content '%%f') -replace '#import site', 'import site' | Set-Content '%%f'"
        echo site-packagesを有効化しました。
    ) else (
        echo site-packagesは既に有効です。
    )
)
echo.

echo [4/5] 必要なディレクトリを作成しています...
if not exist uploads mkdir uploads
if not exist results mkdir results
echo ディレクトリの作成が完了しました。
echo.

echo [5/5] 依存パッケージをインストールしています...
echo この処理には数分かかる場合があります...
echo.

%PYTHON_DIR%\Scripts\pip.exe install opencv-contrib-python numpy Flask Flask-CORS scikit-image

if errorlevel 1 (
    echo.
    echo エラー: パッケージのインストールに失敗しました。
    echo インターネット接続を確認してください。
    pause
    exit /b 1
)

echo.
echo ========================================
echo セットアップが完了しました！
echo ========================================
echo.
echo 次の手順:
echo 1. start_portable.bat をダブルクリックしてアプリを起動
echo 2. ブラウザで http://127.0.0.1:5000 を開く
echo.
pause
