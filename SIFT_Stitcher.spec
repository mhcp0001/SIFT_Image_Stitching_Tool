# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller設定ファイル
SIFT Image Stitching Tool用
"""

import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# データファイルの収集
added_files = [
    ('web', 'web'),  # webフォルダを含める
    ('src/api.py', 'src'),  # api.pyを含める
    ('src/main.py', 'src'),  # main.pyを含める（参照用）
]

# 隠しインポートの指定（OpenCVとFlask関連）
hidden_imports = [
    'cv2',
    'numpy',
    'flask',
    'flask_cors',
    'werkzeug',
    'jinja2',
    'click',
    'itsdangerous',
    'markupsafe',
    'skimage',
    'skimage.metrics',
    'threading',
    'queue',
    'uuid',
    'datetime',
    'json',
    'os',
    'pathlib',
]

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',  # 使用していないので除外
        'PIL',  # OpenCVを使用するので除外
        'tkinter',  # GUIは使用しない
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='SIFT_Stitcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # UPX圧縮を有効化（ファイルサイズを削減）
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # コンソールウィンドウを表示（ログ確認用）
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # アイコンファイルがあれば指定可能
)
