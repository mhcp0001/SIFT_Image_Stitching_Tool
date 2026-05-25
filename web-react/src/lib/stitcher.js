// Port of src/main.py stitching pipeline to OpenCV.js.
//
// Coordinate transform stays faithful to the Python version:
//   closeup pixels --H--> base pixels --Hscale--> canvas pixels
// H is estimated from feature matches; Hscale just scales base->canvas.
//
// OpenCV.js does not garbage-collect cv.Mat objects, so every Mat / vector
// created here is explicitly .delete()'d (see the finally blocks). Leaking
// Mats exhausts the WASM heap after only a handful of large images.

import { blobToImageData, imageDataToPngBlob } from './imageUtils.js';

// SIFT is not present in prebuilt opencv.js (incl. @techstark). ORB is.
// The detector is isolated here so a future custom SIFT WASM build can be
// swapped in without touching the rest of the pipeline.
export function createDetector(cv, detectorName, nfeatures) {
  if (detectorName === 'SIFT') {
    if (typeof cv.SIFT === 'function') {
      return { feature: new cv.SIFT(nfeatures), norm: cv.NORM_L2, name: 'SIFT' };
    }
    throw new Error(
      'このopencv.jsビルドにはSIFTが含まれていません。検出器をORBに切り替えてください。'
    );
  }
  return { feature: new cv.ORB(nfeatures), norm: cv.NORM_HAMMING, name: 'ORB' };
}

function downsample(cv, src, scale) {
  if (scale >= 1.0) return { mat: src, scale: 1.0, owned: false };
  const dst = new cv.Mat();
  const w = Math.max(1, Math.round(src.cols * scale));
  const h = Math.max(1, Math.round(src.rows * scale));
  cv.resize(src, dst, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
  return { mat: dst, scale, owned: true };
}

// Condition number (2-norm) of a 2x2 matrix [[a,b],[c,d]] = sigma_max/sigma_min.
function cond2x2(a, b, c, d) {
  const m = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  const disc = Math.sqrt(Math.max(0, m * m - 4 * det * det));
  const s1 = Math.sqrt(Math.max(0, (m + disc) / 2));
  const s2 = Math.sqrt(Math.max(0, (m - disc) / 2));
  if (s2 < 1e-12) return Infinity;
  return s1 / s2;
}

// Mirrors validate_homography() in main.py.
function validateHomography(H, onLog) {
  const d = H.data64F;
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = d;
  const det =
    h11 * (h22 * h33 - h23 * h32) -
    h12 * (h21 * h33 - h23 * h31) +
    h13 * (h21 * h32 - h22 * h31);
  if (det < 0.003 || det > 300.0) {
    onLog(`[skip] 異常な行列式: ${det.toFixed(4)}`);
    return false;
  }
  const cond = cond2x2(h11, h12, h21, h22);
  if (cond > 10.0) {
    onLog(`[skip] 条件数が大きい: ${cond.toFixed(2)}`);
    return false;
  }
  if (Math.abs(h31) > 0.02 || Math.abs(h32) > 0.02) {
    onLog(`[skip] 射影成分が大きい: h31=${h31.toFixed(4)}, h32=${h32.toFixed(4)}`);
    return false;
  }
  return true;
}

// Returns a CV_64F 3x3 homography (closeup -> base) or null. Caller deletes it.
function computeHomography(cv, det, imgRGB, k1, d1, scale1, opts, onLog) {
  const { downsampleScale, minMatches, ratioTest } = opts;
  const small = downsample(cv, imgRGB, downsampleScale);
  const gray = new cv.Mat();
  const k2 = new cv.KeyPointVector();
  const d2 = new cv.Mat();
  const emptyMask = new cv.Mat();
  const matches = new cv.DMatchVectorVector();
  let bf = null;
  let srcMat = null;
  let dstMat = null;
  let maskOut = null;
  let H = null;

  try {
    cv.cvtColor(small.mat, gray, cv.COLOR_RGB2GRAY);
    det.feature.detectAndCompute(gray, emptyMask, k2, d2);

    if (d2.rows < minMatches) {
      onLog(`[skip] 特徴点が不足: ${d2.rows}`);
      return null;
    }

    bf = new cv.BFMatcher(det.norm, false);
    bf.knnMatch(d1, d2, matches, 2);

    const srcArr = [];
    const dstArr = [];
    for (let i = 0; i < matches.size(); i++) {
      const pair = matches.get(i);
      if (pair.size() >= 2) {
        const m = pair.get(0);
        const n = pair.get(1);
        if (m.distance < ratioTest * n.distance) {
          const p1 = k1.get(m.queryIdx).pt;
          const p2 = k2.get(m.trainIdx).pt;
          srcArr.push(p1.x / scale1, p1.y / scale1);
          dstArr.push(p2.x / small.scale, p2.y / small.scale);
        }
      }
      pair.delete();
    }

    const goodCount = srcArr.length / 2;
    if (goodCount < minMatches) {
      onLog(`[skip] 良マッチが不足: ${goodCount}/${minMatches}`);
      return null;
    }
    onLog(`[debug] good matches: ${goodCount}`);

    srcMat = cv.matFromArray(goodCount, 1, cv.CV_32FC2, srcArr);
    dstMat = cv.matFromArray(goodCount, 1, cv.CV_32FC2, dstArr);
    maskOut = new cv.Mat();

    // findHomography(closeup -> base): dst points are closeup, src points base.
    H = cv.findHomography(dstMat, srcMat, cv.RANSAC, 5.0, maskOut, 5000, 0.99);

    if (H.empty()) {
      onLog('[skip] findHomographyが失敗');
      H.delete();
      return null;
    }

    let inliers = 0;
    for (let i = 0; i < maskOut.rows; i++) inliers += maskOut.data[i] ? 1 : 0;
    const ratio = inliers / goodCount;
    onLog(`[debug] RANSAC inliers: ${inliers}/${goodCount} (${(ratio * 100).toFixed(0)}%)`);
    if (ratio < 0.1) {
      onLog(`[skip] インライア率が低い: ${(ratio * 100).toFixed(0)}%`);
      H.delete();
      return null;
    }

    return H;
  } finally {
    gray.delete();
    k2.delete();
    d2.delete();
    emptyMask.delete();
    matches.delete();
    if (bf) bf.delete();
    if (srcMat) srcMat.delete();
    if (dstMat) dstMat.delete();
    if (maskOut) maskOut.delete();
    if (small.owned) small.mat.delete();
  }
}

// Mirrors warp_and_blend(): warp image to the canvas, build a Gaussian-blurred
// alpha mask, and composite canvas*(1-mask) + warped*mask. Updates canvasMat
// in place.
function warpAndBlend(cv, canvasMat, imgRGB, H, strength) {
  const dsize = new cv.Size(canvasMat.cols, canvasMat.rows);
  const k = strength % 2 === 1 ? strength : strength + 1;

  const warped = new cv.Mat();
  const mask = new cv.Mat(imgRGB.rows, imgRGB.cols, cv.CV_8UC1, new cv.Scalar(255));
  const maskWarped = new cv.Mat();
  const maskBlur = new cv.Mat();
  const maskF = new cv.Mat();
  const maskF3 = new cv.Mat();
  const ones = new cv.Mat(canvasMat.rows, canvasMat.cols, cv.CV_32FC3, new cv.Scalar(1, 1, 1));
  const invMask = new cv.Mat();
  const canvasF = new cv.Mat();
  const warpedF = new cv.Mat();
  const t1 = new cv.Mat();
  const t2 = new cv.Mat();
  const blended = new cv.Mat();

  try {
    cv.warpPerspective(imgRGB, warped, H, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    cv.warpPerspective(mask, maskWarped, H, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0));
    cv.GaussianBlur(maskWarped, maskBlur, new cv.Size(k, k), 0, 0, cv.BORDER_DEFAULT);

    maskBlur.convertTo(maskF, cv.CV_32FC1, 1 / 255);
    cv.cvtColor(maskF, maskF3, cv.COLOR_GRAY2RGB);
    cv.subtract(ones, maskF3, invMask);

    canvasMat.convertTo(canvasF, cv.CV_32FC3);
    warped.convertTo(warpedF, cv.CV_32FC3);

    cv.multiply(canvasF, invMask, t1);
    cv.multiply(warpedF, maskF3, t2);
    cv.add(t1, t2, blended);

    blended.convertTo(canvasMat, cv.CV_8UC3); // saturating cast == np.clip(...).astype(uint8)
  } finally {
    warped.delete();
    mask.delete();
    maskWarped.delete();
    maskBlur.delete();
    maskF.delete();
    maskF3.delete();
    ones.delete();
    invMask.delete();
    canvasF.delete();
    warpedF.delete();
    t1.delete();
    t2.delete();
    blended.delete();
  }
}

async function blobToRGB(cv, blob) {
  const imageData = await blobToImageData(blob);
  const rgba = cv.matFromImageData(imageData);
  const rgb = new cv.Mat();
  cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
  rgba.delete();
  return rgb;
}

// payload: { overview: Blob, closeups: [{ name, blob }], params }
// callbacks: { onProgress(message), onLog(line) }
export async function stitch(cv, payload, { onProgress, onLog }) {
  const { overview, closeups, params } = payload;
  const {
    canvasScale,
    strength,
    minMatches,
    ratioTest,
    nfeatures,
    downsampleScale,
    detector: detectorName,
  } = params;

  const detector = createDetector(cv, detectorName, nfeatures);

  let baseRGB = null;
  let canvasMat = null;
  let baseGray = null;
  const baseSmall = { owned: false, mat: null };
  const k1 = new cv.KeyPointVector();
  const d1 = new cv.Mat();
  const emptyMask = new cv.Mat();

  let success = 0;
  let skip = 0;

  try {
    onProgress('広角画像を読み込み中...');
    baseRGB = await blobToRGB(cv, overview);

    canvasMat = new cv.Mat();
    cv.resize(
      baseRGB,
      canvasMat,
      new cv.Size(baseRGB.cols * canvasScale, baseRGB.rows * canvasScale),
      0,
      0,
      cv.INTER_CUBIC
    );
    onLog(`[info] キャンバス生成: ${canvasMat.cols}x${canvasMat.rows} (${canvasScale}x)`);

    onProgress('広角画像の特徴量を計算中...');
    const ds = downsample(cv, baseRGB, downsampleScale);
    baseSmall.owned = ds.owned;
    baseSmall.mat = ds.mat;
    const scale1 = ds.scale;
    baseGray = new cv.Mat();
    cv.cvtColor(baseSmall.mat, baseGray, cv.COLOR_RGB2GRAY);
    detector.feature.detectAndCompute(baseGray, emptyMask, k1, d1);
    if (d1.rows === 0) {
      throw new Error('広角画像から特徴点を検出できませんでした。');
    }
    onLog(`[info] ${detector.name} 特徴点: ${d1.rows} (scale=${scale1.toFixed(2)})`);

    const sorted = [...closeups].sort((a, b) => a.name.localeCompare(b.name));
    const total = sorted.length;

    for (let i = 0; i < total; i++) {
      const { name, blob } = sorted[i];
      onProgress(`クローズアップを合成中... (${i + 1}/${total}) ${name}`);

      let imgRGB = null;
      let H = null;
      let Hcanvas = null;
      try {
        imgRGB = await blobToRGB(cv, blob);
        H = computeHomography(cv, detector, imgRGB, k1, d1, scale1, { downsampleScale, minMatches, ratioTest }, onLog);
        if (!H) {
          onLog(`[skip] ${name}`);
          skip += 1;
          continue;
        }
        if (!validateHomography(H, onLog)) {
          onLog(`[skip] ${name} : ホモグラフィが不正`);
          skip += 1;
          continue;
        }
        // Hcanvas = Hscale @ H, where Hscale = diag(canvasScale, canvasScale, 1).
        // Scaling only the first two rows is exactly that product.
        const h = H.data64F;
        Hcanvas = cv.matFromArray(3, 3, cv.CV_64F, [
          canvasScale * h[0], canvasScale * h[1], canvasScale * h[2],
          canvasScale * h[3], canvasScale * h[4], canvasScale * h[5],
          h[6], h[7], h[8],
        ]);
        warpAndBlend(cv, canvasMat, imgRGB, Hcanvas, strength);
        onLog(`[blend] ${name}`);
        success += 1;
      } finally {
        if (imgRGB) imgRGB.delete();
        if (H) H.delete();
        if (Hcanvas) Hcanvas.delete();
      }
    }

    onProgress('結果を生成中...');
    const out = new cv.Mat();
    cv.cvtColor(canvasMat, out, cv.COLOR_RGB2RGBA);
    const width = out.cols;
    const height = out.rows;
    const imageData = new ImageData(new Uint8ClampedArray(out.data), width, height);
    out.delete();
    const blob = await imageDataToPngBlob(imageData);

    onLog(`--- 完了 --- 成功: ${success}, スキップ: ${skip} ---`);
    return { blob, width, height, success, skip, total };
  } finally {
    detector.feature.delete();
    if (baseRGB) baseRGB.delete();
    if (canvasMat) canvasMat.delete();
    if (baseGray) baseGray.delete();
    if (baseSmall.owned && baseSmall.mat) baseSmall.mat.delete();
    k1.delete();
    d1.delete();
    emptyMask.delete();
  }
}
