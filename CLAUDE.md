# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

「英語で教えて」「翻訳して」のような明示が無い限りは、必ず日本語で応答する

## Overview

This is a SIFT-based image stitching tool written in Python that combines a wide-angle overview image with multiple high-resolution closeup images. The tool uses OpenCV's SIFT (Scale-Invariant Feature Transform) algorithm to detect matching features between images and blends closeups onto an upscaled canvas using homography transformations and Gaussian blur masking.

## Architecture

### Core Processing Pipeline

The main workflow in `src/main.py` follows this sequence:

1. **Initialization** (`setup_logging`): Creates a log file and initializes SIFT detector
2. **Input Validation**: Loads overview image (`img/overview.jpg`) and discovers closeup images (`img/closeups/*.jpg`)
3. **Canvas Preparation**: Resizes overview image by `CANVAS_SCALE` (3x) and computes base SIFT features once
4. **Stitching Loop**: For each closeup image:
   - Compute SIFT features and match against base image features
   - Calculate homography transformation using RANSAC
   - Warp closeup to canvas coordinates
   - Blend using Gaussian-blurred mask for smooth transitions
5. **Output**: Saves final stitched image to `img/stitched.png` with processing stats logged to `img/stitch.log`

### Key Design Patterns

- **Global SIFT Detector**: SIFT detector is initialized once at module level with fallback for different OpenCV versions
- **In-place Canvas Updates**: The canvas is modified in-place during blending to avoid memory overhead
- **Pre-computed Base Features**: Base image features (k1, d1) are computed once and reused across all closeup images
- **Coordinate System Transform**: Two-stage homography: (1) closeup → base coordinates, (2) base → canvas coordinates via `Hscale`

### Critical Parameters

Located at the top of `src/main.py`:

- `CANVAS_SCALE = 3`: Upscaling factor for final output resolution
- `STRENGTH = 31`: Gaussian blur kernel size for blending (must be odd)
- `SIFT_MIN_MATCHES = 12`: Minimum feature matches required for valid homography
- `SIFT_RATIO_TEST = 0.75`: Lowe's ratio test threshold for filtering good matches

## Development Commands

### Running the Stitcher

```bash
cd C:\Users\71532412\workspace\SIFT_Image_Stitching_Tool
python src/main.py
```

**Prerequisites**:
- Overview image must exist at `img/overview.jpg`
- Closeup images must exist in `img/closeups/*.jpg`
- Output will be saved to `img/stitched.png`
- Processing log appends to `img/stitch.log`

### Analyzing Results

```bash
python tools/analyze_stitched.py
```

This generates:
- `img/stitched_report.json`: Detailed metrics (dimensions, channel statistics, Laplacian variance for sharpness, PSNR/SSIM vs overview)
- `img/stitched_thumb.jpg`: Downscaled thumbnail (max 1200px)
- `img/stitched_seam_heatmap.jpg`: Sobel gradient heatmap overlay to visualize seam quality

## Dependencies

- **opencv-python** or **opencv-contrib-python**: Core library for SIFT and image operations
- **numpy**: Array operations and homography math
- **skimage** (optional): Only for SSIM calculation in analyze_stitched.py

Note: SIFT requires `opencv-contrib-python` on some OpenCV versions. The code includes compatibility fallback logic.

## Important Implementation Notes

### SIFT Feature Matching

- Uses BFMatcher (Brute-Force) with knnMatch (k=2) for Lowe's ratio test
- Homography computed with RANSAC (threshold=5.0) for robustness against outliers
- Failed matches are logged but don't halt processing (graceful degradation)

### Blending Strategy

The `warp_and_blend` function uses alpha blending with a Gaussian-blurred mask:
- Creates binary mask of warped image region
- Applies Gaussian blur to create soft edges
- Blends: `canvas * (1 - mask) + warped * mask`
- All operations in float32 to avoid precision loss, then clipped back to uint8

### Logging Architecture

- Dual output: All messages go to both console (stdout) and `img/stitch.log`
- Log file opened in append mode with flush on every write for crash recovery
- Tracks success/skip counts and per-image status ([INFO], [blend], [skip], [ERROR])

## Common Modifications

### Adjusting Blend Quality

To modify blending smoothness, change `STRENGTH` parameter (must be odd):
- Lower values (e.g., 11, 15): Sharper transitions, visible seams
- Higher values (e.g., 51, 71): Smoother transitions, potential ghosting artifacts

### Changing Output Resolution

Modify `CANVAS_SCALE`:
- Higher values increase output resolution and VRAM usage
- Lower values reduce output quality but speed up processing

### Tuning Feature Matching

- Increase `SIFT_MIN_MATCHES` for stricter alignment (may reject more images)
- Decrease `SIFT_RATIO_TEST` for more conservative matches (fewer false positives)

## File Structure Notes

- `src/main.py`: Single-file monolithic implementation (no modules/classes)
- `tools/`: Standalone utility scripts (not imported by main)
- `img/`: Input/output directory convention (hardcoded paths relative to CWD)
- The tool expects to be run from repository root directory
