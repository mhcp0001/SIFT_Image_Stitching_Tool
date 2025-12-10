"""
SIFT Image Stitching Tool - Launcher
ブラウザ自動起動機能付きのFlaskサーバーランチャー
PyInstallerでexe化する際のエントリーポイント
"""

import os
import sys
import webbrowser
import threading
import time
from pathlib import Path

def get_resource_path(relative_path):
    """
    PyInstallerでexe化した際のリソースパスを取得
    開発時とexe化後の両方で動作する
    """
    try:
        # PyInstallerで作成されたexeの場合
        base_path = sys._MEIPASS
    except AttributeError:
        # 通常のPythonスクリプトとして実行されている場合
        base_path = os.path.dirname(os.path.abspath(__file__))

    return os.path.join(base_path, relative_path)

def open_browser():
    """
    サーバー起動後にブラウザを自動的に開く
    """
    time.sleep(2)  # サーバーの起動を待つ
    url = 'http://127.0.0.1:5000'
    print(f"\nブラウザを開いています: {url}")
    webbrowser.open(url)

def setup_directories():
    """
    必要なディレクトリを作成
    """
    # exeと同じディレクトリにuploads/resultsを作成
    if getattr(sys, 'frozen', False):
        # exe化されている場合
        base_dir = os.path.dirname(sys.executable)
    else:
        # 通常のPythonスクリプトの場合
        base_dir = os.path.dirname(os.path.abspath(__file__))

    uploads_dir = os.path.join(base_dir, 'uploads')
    results_dir = os.path.join(base_dir, 'results')

    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    return base_dir, uploads_dir, results_dir

def main():
    """
    メイン関数
    """
    print("=" * 50)
    print("SIFT Image Stitching Tool")
    print("=" * 50)
    print()

    # ディレクトリのセットアップ
    base_dir, uploads_dir, results_dir = setup_directories()
    print(f"作業ディレクトリ: {base_dir}")
    print(f"アップロードフォルダ: {uploads_dir}")
    print(f"結果フォルダ: {results_dir}")
    print()

    # Flaskアプリケーションのインポート
    # srcディレクトリをPythonパスに追加
    src_path = get_resource_path('src')
    if src_path not in sys.path:
        sys.path.insert(0, src_path)

    # webディレクトリのパスを設定
    web_path = get_resource_path('web')

    # api.pyをインポート
    try:
        import api

        # Flaskアプリの静的ファイルパスを更新
        api.app.static_folder = web_path
        api.app.static_url_path = ''

        # アップロード/結果フォルダのパスを更新
        api.UPLOAD_FOLDER = uploads_dir
        api.RESULTS_FOLDER = results_dir

        print("Flask アプリケーションを初期化しました")
        print()

    except ImportError as e:
        print(f"エラー: api.pyのインポートに失敗しました: {e}")
        print("src/api.py が正しく配置されているか確認してください")
        input("\nEnterキーを押して終了...")
        sys.exit(1)

    # ブラウザを別スレッドで起動
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # Flaskサーバーを起動
    print("Flask開発サーバーを起動しています...")
    print("ブラウザで http://127.0.0.1:5000 を開いてください")
    print("終了するには Ctrl+C を押してください")
    print()
    print("=" * 50)
    print()

    try:
        # Flaskサーバーを起動（debugモードはオフ）
        api.app.run(debug=False, host='127.0.0.1', port=5000, threaded=True)
    except KeyboardInterrupt:
        print("\n\nサーバーを停止しています...")
        print("終了しました。")
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")
        input("\nEnterキーを押して終了...")
        sys.exit(1)

if __name__ == '__main__':
    main()
