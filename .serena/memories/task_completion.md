# タスク完了時の手順

## 現在のプロジェクト状態

このプロジェクトには以下の自動化ツールは**設定されていない**:
- テストスイート（pytest、unittest など）
- リンター（flake8、pylint、ruff など）
- コードフォーマッター（black、autopep8 など）
- 型チェッカー（mypy など）
- CI/CD パイプライン

## タスク完了時に実行すべきこと

### 1. コード変更後の基本確認

#### a. 構文エラーチェック
```bash
python -m py_compile src/main.py
```

または

```bash
python src/main.py --help
```
（エラーが出ればインポート時点で検出される）

#### b. 実際の動作確認
```bash
python src/main.py
```

**確認ポイント**:
- プログラムが正常終了するか
- `img/stitched.png` が生成されるか
- `img/stitch.log` にエラーが記録されていないか
- コンソール出力に `[ERROR]` や `[CRITICAL ERROR]` がないか

### 2. ログ確認

#### 最新のログエントリを確認
```bash
type img\stitch.log
```

**確認ポイント**:
- Success カウントとSkip カウント
- `[blend]` メッセージ数（成功した合成数）
- `[skip]` メッセージ（失敗理由を確認）
- タイムスタンプが正しいか

### 3. 出力画像の品質確認

#### 分析ツールで詳細メトリクスを取得
```bash
python tools/analyze_stitched.py
```

**確認する出力**:
- `img/stitched_report.json`: 統計データ
- `img/stitched_thumb.jpg`: サムネイルで視覚確認
- `img/stitched_seam_heatmap.jpg`: シーム品質ヒートマップ

**主要メトリクス**:
- `laplacian_variance`: 鮮明度指標（高いほど良い）
- `means`, `stds`: チャンネル統計の妥当性
- PSNR/SSIM: オーバービュー画像との類似性

### 4. パラメータ調整後の確認

パラメータを変更した場合は、複数の設定で実行して比較:

#### ブレンディング強度の影響確認
```python
# STRENGTH を変更して実行
STRENGTH = 15  # シャープな境界
STRENGTH = 31  # デフォルト
STRENGTH = 51  # 滑らかな境界
```

#### 特徴点マッチング閾値の影響確認
```python
# SIFT_MIN_MATCHES を変更して実行
SIFT_MIN_MATCHES = 8   # より多くの画像を受け入れる
SIFT_MIN_MATCHES = 12  # デフォルト
SIFT_MIN_MATCHES = 20  # より厳格な選別
```

### 5. Git コミット前の確認

#### a. 変更ファイルの確認
```bash
git status
git diff src/main.py
```

#### b. コミット
```bash
git add src/main.py
git commit -m "簡潔な変更説明（日本語可）"
```

**コミットメッセージ例**:
- "ブレンディング強度パラメータをSTRENGTH=31に変更"
- "SIFT最小マッチ数を12に引き上げて精度向上"
- "ログメッセージの整形を改善"

### 6. 新機能追加時の追加確認

#### analyze_stitched.py の変更の場合
```bash
python tools/analyze_stitched.py
```

確認:
- `img/stitched_report.json` が正しく生成されるか
- JSONフォーマットが妥当か
- サムネイルとヒートマップが生成されるか

## 推奨される開発フロー

1. **変更実施**: コードを編集
2. **構文チェック**: `python -m py_compile src/main.py`
3. **動作確認**: `python src/main.py` 実行
4. **ログ確認**: `type img\stitch.log` で最新ログ確認
5. **品質確認**: `python tools/analyze_stitched.py` で詳細分析
6. **Git操作**: `git add` → `git commit`

## 将来の改善案

現在不足している以下のツールを導入すると、開発効率が向上する可能性がある:

- **pytest**: ユニットテスト自動化
- **black** または **ruff**: コードフォーマット自動化
- **flake8** または **ruff**: リント自動化
- **mypy**: 型チェック
- **requirements.txt**: 依存関係管理の明示化
- **GitHub Actions**: CI/CD パイプライン（自動テスト実行）

ただし、現時点ではこれらは設定されていないため、タスク完了時の必須手順ではない。
