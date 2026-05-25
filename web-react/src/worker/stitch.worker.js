// Heavy OpenCV.js work runs here so the UI thread never freezes. opencv.js is
// initialized once on worker startup; @techstark/opencv-js's default export is
// a promise that resolves to the ready cv module.
import cvReadyPromise from '@techstark/opencv-js';
import { stitch } from '../lib/stitcher.js';

let cvPromise = null;

function ensureCv() {
  if (!cvPromise) cvPromise = cvReadyPromise;
  return cvPromise;
}

ensureCv()
  .then(() => self.postMessage({ type: 'ready' }))
  .catch((err) => self.postMessage({ type: 'error', message: err?.message || String(err) }));

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg?.type !== 'stitch') return;
  try {
    const cv = await ensureCv();
    const result = await stitch(cv, msg.payload, {
      onProgress: (message) => self.postMessage({ type: 'progress', message }),
      onLog: (line) => self.postMessage({ type: 'log', line }),
    });
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
