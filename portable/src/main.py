import cv2 as cv
import numpy as np
import glob
import sys
from datetime import datetime
import os

# --- 2. ファイルI/Oとパス (固定値) ---
OVERVIEW = "overview.jpg"
CLOSEUPS_GLOB = "closeups/*.jpg"
OUT = "stitched.png"
LOG_FILE = "stitch.log"

# --- 3. 処理パラメータ (固定値) ---
CANVAS_SCALE = 2
STRENGTH = 31  # ブレンディング強度 (奇数)
SIFT_MIN_MATCHES = 12
SIFT_RATIO_TEST = 0.75

# --- グローバル変数 ---
log_f = None
# SIFT detectorの初期化（OpenCVのバージョンによって異なる場合に対応）
try:
    sift = cv.SIFT_create(
        nOctaveLayers=5,      # デフォルト3→5: より多くのスケールで検出
        contrastThreshold=0.03,  # デフォルト0.04→0.03: より多くの特徴点
        edgeThreshold=15      # デフォルト10→15: エッジ応答の閾値を緩和
        )
except AttributeError:
    try:
        sift = cv.xfeatures2d.SIFT_create()
    except AttributeError:
        print("[CRITICAL ERROR] SIFT is not available in your OpenCV installation. Please install opencv-contrib-python.")
        sys.exit(1)


# --- 5. 関数シグネチャ (ロギング) ---

def setup_logging():
    """
    ログファイルを初期化し、グローバルファイルハンドルを設定し、開始時刻を書き込む。
    """
    global log_f
    try:
        # 追記モード (a) でファイルを開く
        log_f = open(LOG_FILE, "a", encoding="utf-8")

        # [起動] ログ初期化 (質問2=B案)
        start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        write_log(f"{start_time} --- Processing Start ---")

    except IOError as e:
        print(f"[CRITICAL ERROR] Failed to open log file: {LOG_FILE}. {e}")
        sys.exit(1)  # ログファイルが開けない場合は続行不可


def write_log(message: str):
    """
    メッセージをコンソール(print)とログファイルの両方に書き出す。
    """
    print(message)
    if log_f:
        try:
            log_f.write(message + "\n")
            log_f.flush()  # 追記モードでも即時書き込みを保証
        except IOError as e:
            print(f"[ERROR] Failed to write to log file. {e}")


# --- 5. 関数シグネチャ (コアロジック) ---


def homography_sift(img, k1, d1):
    """
    SIFT特徴量に基づき、base (k1, d1) から img へのホモグラフィを計算する。
    k1, d1 はループ外で計算済みのものを利用する。
    """
    try:
        img_gray = cv.cvtColor(img, cv.COLOR_BGR2GRAY)

        # imgの特徴量を計算
        k2, d2 = sift.detectAndCompute(img_gray, None)

        if d2 is None or len(d2) < SIFT_MIN_MATCHES:
            write_log(f"[DEBUG] Not enough features found in closeup image. Found: {len(d2) if d2 is not None else 0}")
            return None

        # BFMatcher (Brute-Force Matcher)
        bf = cv.BFMatcher()
        matches = bf.knnMatch(d1, d2, k=2)

        # Lowe's ratio test
        good = []
        for m_n in matches:
            if len(m_n) == 2:
                m, n = m_n
                # SIFTマッチング閾値: SIFT_RATIO_TEST
                if m.distance < SIFT_RATIO_TEST * n.distance:
                    good.append(m)

        # SIFT最小マッチ数: SIFT_MIN_MATCHES
        if len(good) < SIFT_MIN_MATCHES:
            msg = (
                f"[DEBUG] Not enough good matches. Found {len(good)}, "
                f"required {SIFT_MIN_MATCHES}."
            )
            write_log(msg)
            return None

        write_log(f"[DEBUG] Found {len(good)} good matches.")

        # ホモグラフィを計算
        src_pts = np.float32([
            k1[m.queryIdx].pt
            for m in good
        ]).reshape(-1, 1, 2)

        dst_pts = np.float32([
            k2[m.trainIdx].pt
            for m in good
        ]).reshape(-1, 1, 2)

        # RANSACパラメータを最適化（より厳格な外れ値除去）
        H, mask = cv.findHomography(
            dst_pts, src_pts,
            method=cv.RANSAC,
            ransacReprojThreshold=3.0,  # 5.0→3.0: より厳格な閾値
            maxIters=5000,              # デフォルト2000→5000: より徹底的な探索
            confidence=0.995            # デフォルト0.99→0.995: より高い信頼度
        )

        if H is None:
            write_log("[DEBUG] findHomography returned None.")
            return None

        # インライア数とインライア率をログ出力し、品質チェック
        if mask is not None:
            inliers = np.sum(mask)
            inlier_ratio = inliers / len(good)
            write_log(f"[DEBUG] RANSAC inliers: {inliers}/{len(good)} ({inlier_ratio:.1%})")

            # インライア率が10%未満の場合は拒否
            if inlier_ratio < 0.1:
                write_log(f"[WARNING] Low inlier ratio {inlier_ratio:.1%}, rejecting homography")
                return None

        return H

    except cv.error as e:
        write_log(f"[ERROR] OpenCV error in homography_sift: {e}")
        return None
    except Exception as e:
        write_log(f"[ERROR] Unexpected error in homography_sift: {e}")
        return None


def validate_homography(H):
    """
    ホモグラフィ行列の妥当性を検証する。

    検証項目:
    1. 条件数（Condition Number）: 行列の数値安定性
    2. 行列式（Determinant）: スケール変換の妥当性
    3. 射影成分（h31, h32）: 極端な遠近法歪みの検出

    Returns:
        bool: ホモグラフィが妥当な場合True、そうでない場合False
    """
    if H is None:
        return False

    try:
        # 1. 条件数チェック（左上2x2の回転・スケール行列）
        cond = np.linalg.cond(H[:2, :2])
        if cond > 10.0:
            write_log(f"[WARNING] High condition number: {cond:.2f}, matrix is ill-conditioned")
            return False

        # 2. 行列式チェック（スケール変換の妥当性）
        det = np.linalg.det(H)
        if det < 0.01 or det > 100.0:
            write_log(f"[WARNING] Abnormal determinant: {det:.4f}, extreme scaling detected")
            return False

        # 3. 射影成分チェック（平面変換の仮定）
        if abs(H[2, 0]) > 0.01 or abs(H[2, 1]) > 0.01:
            write_log(f"[WARNING] Large perspective components: h31={H[2, 0]:.4f}, h32={H[2, 1]:.4f}")
            return False

        return True

    except Exception as e:
        write_log(f"[ERROR] Error validating homography: {e}")
        return False


def warp_and_blend(canvas, img, H, strength):
    """
    img を H に従ってワープし、ガウシアンブラーマスクを使用して canvas にブレンディングする。
    canvas はインプレース(参照渡し)で更新される。
    """
    h_canvas, w_canvas = canvas.shape[:2]
    h_img, w_img = img.shape[:2]

    try:
        # 1. img を canvas サイズにワープ
        warped = cv.warpPerspective(img, H, (w_canvas, h_canvas))

        # 2. img のマスクを作成 (imgが存在する領域=255)
        mask = np.ones((h_img, w_img), dtype=np.uint8) * 255
        mask_warped = cv.warpPerspective(mask, H, (w_canvas, h_canvas))

        # 3. マスクのエッジをぼかす (STRENGTHを使用)
        # strength は奇数である必要がある
        blend_strength = strength if strength % 2 == 1 else strength + 1

        # ガウシアンブラーで滑らかなマスクを作成
        mask_blur = cv.GaussianBlur(
            mask_warped, (blend_strength, blend_strength), 0
        )

        # 4. マスクを 0.0 ～ 1.0 の浮動小数点数に変換
        mask_float = mask_blur.astype(np.float32) / 255.0

        # 5. 3チャンネル (BGR) に拡張
        mask_float_3ch = cv.cvtColor(mask_float, cv.COLOR_GRAY2BGR)

        # 6. 計算のために float32 に変換
        canvas_float = canvas.astype(np.float32)
        warped_float = warped.astype(np.float32)

        # 7. アルファブレンディング
        # blended = canvas * (1 - mask) + warped * (mask)
        blended = (
            canvas_float * (1.0 - mask_float_3ch)
            + warped_float * mask_float_3ch
        )

        # 8. 0-255 の範囲にクリップし、uint8 に戻して canvas を更新
        canvas[:] = np.clip(blended, 0, 255).astype(np.uint8)

    except cv.error as e:
        write_log(f"[ERROR] OpenCV error in warp_and_blend: {e}")
    except Exception as e:
        write_log(f"[ERROR] Unexpected error in warp_and_blend: {e}")


# --- 4. 実行フロー ---


def main():

    # [起動] ログ初期化
    setup_logging()

    # [入力検証 1] 広角画像読み込み
    try:
        base = cv.imread(OVERVIEW)
        if base is None:
            write_log(f"[ERROR] Overview image not found: {OVERVIEW}")
            sys.exit(1)  # 処理停止
    except Exception as e:
        write_log(f"[ERROR] Failed to read {OVERVIEW}: {e}")
        sys.exit(1)

    write_log(f"[INFO] Loaded overview image: {OVERVIEW}")

    # [入力検証 2] 近接画像リスト取得
    try:
        closeups_paths = glob.glob(CLOSEUPS_GLOB)
        if not closeups_paths:
            msg = (
                "[ERROR] No closeup images found matching pattern: "
                + CLOSEUPS_GLOB
            )
            write_log(msg)
            sys.exit(1)  # 処理停止
    except Exception as e:
        write_log(f"[ERROR] Error during glob search {CLOSEUPS_GLOB}: {e}")
        sys.exit(1)

    write_log(f"[INFO] Found {len(closeups_paths)} closeup images.")

    # [前処理] キャンバスと基準特徴量の準備
    h_base, w_base = base.shape[:2]

    # 1. 広角画像を CANVAS_SCALE 倍にリサイズし、canvas 変数に格納
    try:
        new_w = w_base * CANVAS_SCALE
        new_h = h_base * CANVAS_SCALE
        canvas = cv.resize(
            base, (new_w, new_h), interpolation=cv.INTER_CUBIC
        )
    except cv.error as e:
        write_log(f"[ERROR] Failed to resize canvas: {e}")
        sys.exit(1)

    write_log(
        f"[INFO] Canvas created with scale {CANVAS_SCALE}x. "
        f"Dimensions: {canvas.shape[1]}x{canvas.shape[0]}"
    )

    # 2. リサイズ前の base 画像（グレースケール）からSIFT特徴量（k1, d1）を計算
    try:
        base_gray = cv.cvtColor(base, cv.COLOR_BGR2GRAY)
        k1, d1 = sift.detectAndCompute(base_gray, None)
        if d1 is None or len(k1) == 0:
            write_log(
                "[ERROR] Could not compute SIFT features "
                "from overview image."
            )
            sys.exit(1)
    except cv.error as e:
        write_log(f"[ERROR] Failed to compute SIFT on base image: {e}")
        sys.exit(1)

    # 3. スケーリング行列の準備 (base座標系 -> canvas座標系)
    Hscale = np.array([
        [CANVAS_SCALE, 0, 0],
        [0, CANVAS_SCALE, 0],
        [0, 0, 1]
    ], dtype=np.float32)

    # 4. カウンター変数初期化
    success_count = 0
    skip_count = 0

    # [メイン処理] 合成ループ
    # ファイル名順 (sorted) でループ
    for path in sorted(closeups_paths):
        filename = os.path.basename(path)

        # a. (読み込み)
        img = cv.imread(path)

        # b. (読み込み失敗)
        if img is None:
            write_log(f"[skip] {filename} : Cannot read image")
            skip_count += 1
            continue

        write_log(f"[INFO] Processing: {filename}")

        # c. (SIFT推定) k1, d1 を渡す
        H = homography_sift(img, k1, d1)

        # d. (推定失敗)
        if H is None:
            write_log(f"[skip] {filename} : homography failed")
            skip_count += 1
            continue

        # e. (ホモグラフィ妥当性検証)
        if not validate_homography(H):
            write_log(f"[skip] {filename} : invalid homography matrix")
            skip_count += 1
            continue

        # e. (合成処理)
        try:
            # i. キャンバス座標系への変換行列
            H_to_canvas = Hscale @ H

            # ii. warp_and_blend (canvas を直接更新)
            warp_and_blend(canvas, img, H_to_canvas, strength=STRENGTH)

            # iii. ログに [blend] を記録
            write_log(f"[blend] {filename}")
            success_count += 1

        except Exception as e:
            write_log(f"[skip] {filename} : Error during warp/blend: {e}")
            skip_count += 1

    # [終了処理 1] 結果保存
    try:
        cv.imwrite(OUT, canvas)
        write_log(f"Saved: {OUT}")
    except cv.error as e:
        write_log(f"[ERROR] Failed to save output image {OUT}: {e}")
    except Exception as e:
        write_log(f"[ERROR] Unexpected error saving {OUT}: {e}")

    # [終了処理 2] ログ集計
    write_log(
        f"--- Processing End --- Success: {success_count}, "
        f"Skip: {skip_count} ---"
    )

    # ログファイルを閉じる
    if log_f:
        log_f.close()


if __name__ == "__main__":
    main()