from pathlib import Path
import cv2
import numpy as np
import json

img_dir = Path('img')
stitched_path = img_dir / 'stitched.png'
thumb_path = img_dir / 'stitched_thumb.jpg'
heatmap_path = img_dir / 'stitched_seam_heatmap.jpg'
report_path = img_dir / 'stitched_report.json'

result = {'stitched': str(stitched_path)}

if not stitched_path.exists():
    result['error'] = 'stitched file not found'
else:
    im = cv2.imread(str(stitched_path), cv2.IMREAD_COLOR)
    if im is None:
        result['error'] = 'cv2 failed to read image'
    else:
        h, w = im.shape[:2]
        result.update({'width': w, 'height': h, 'dtype': str(im.dtype), 'channels': im.shape[2]})
        # per-channel stats
        mins = [int(im[:,:,c].min()) for c in range(3)]
        maxs = [int(im[:,:,c].max()) for c in range(3)]
        means = [float(im[:,:,c].mean()) for c in range(3)]
        stds = [float(im[:,:,c].std()) for c in range(3)]
        result.update({'mins': mins, 'maxs': maxs, 'means': means, 'stds': stds})

        # thumbnail
        max_dim = 1200
        scale = min(max_dim / w, max_dim / h, 1.0)
        tw, th = max(1, int(w*scale)), max(1, int(h*scale))
        thumb = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(thumb_path), thumb, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        result['thumbnail'] = str(thumb_path)

        # sharpness (Laplacian variance)
        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var = float(lap.var())
        result['laplacian_variance'] = lap_var

        # seam/edge heatmap: gradient magnitude via Sobel
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        grad = np.hypot(sobelx, sobely)
        # normalize grad to 0-255
        gmin, gmax = float(grad.min()), float(grad.max())
        if gmax > gmin:
            grad_norm = ((grad - gmin) / (gmax - gmin) * 255.0).astype(np.uint8)
        else:
            grad_norm = np.zeros_like(gray, dtype=np.uint8)
        # create heatmap using applyColorMap
        heatmap = cv2.applyColorMap(grad_norm, cv2.COLORMAP_JET)
        # overlay heatmap semi-transparently on resized thumbnail for quick view
        heat_thumb = cv2.resize(heatmap, (tw, th), interpolation=cv2.INTER_AREA)
        overlay = cv2.addWeighted(heat_thumb, 0.6, thumb, 0.4, 0)
        cv2.imwrite(str(heatmap_path), overlay, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        result['heatmap'] = str(heatmap_path)

        # PSNR against overview (if available)
        overview_path = img_dir / 'overview.jpg'
        if overview_path.exists():
            ov = cv2.imread(str(overview_path), cv2.IMREAD_COLOR)
            if ov is None:
                result['overview_read_ok'] = False
            else:
                result['overview_read_ok'] = True
                # resize overview to stitched size for metric (note: may be distorted)
                try:
                    ov_resized = cv2.resize(ov, (w, h), interpolation=cv2.INTER_LINEAR)
                    psnr = float(cv2.PSNR(im, ov_resized))
                    result['psnr_vs_overview'] = psnr
                except Exception as e:
                    result['psnr_error'] = repr(e)
        else:
            result['overview_read_ok'] = False

        # try SSIM if skimage available
        try:
            from skimage.metrics import structural_similarity as ssim
            im_gray = gray
            if 'ov_resized' in locals():
                ov_gray = cv2.cvtColor(ov_resized, cv2.COLOR_BGR2GRAY)
                s, _ = ssim(im_gray, ov_gray, full=True)
                result['ssim_vs_overview'] = float(s)
        except Exception as e:
            result['ssim_error'] = str(e)

# ensure output directory exists and save report
report_path.parent.mkdir(parents=True, exist_ok=True)
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(json.dumps(result, ensure_ascii=False, indent=2))
