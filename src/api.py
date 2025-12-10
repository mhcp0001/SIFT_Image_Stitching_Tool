"""
SIFT Image Stitching Web API
Flask-based REST API for image stitching operations
"""

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
import uuid
import threading
import time
from datetime import datetime
import cv2 as cv
import numpy as np
import glob

# Import existing SIFT logic
import sys
sys.path.insert(0, os.path.dirname(__file__))

# --- Configuration ---
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
RESULTS_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'results')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max

# Create directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Global processing state
processing_jobs = {}

# SIFT detector initialization
try:
    sift = cv.SIFT_create(
        nOctaveLayers=5,
        contrastThreshold=0.03,
        edgeThreshold=15
    )
except AttributeError:
    try:
        sift = cv.xfeatures2d.SIFT_create()
    except AttributeError:
        print("[CRITICAL ERROR] SIFT is not available")
        sys.exit(1)


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def log_message(job_id, message):
    """Add log message to job"""
    if job_id in processing_jobs:
        processing_jobs[job_id]['logs'].append({
            'timestamp': datetime.now().isoformat(),
            'message': message
        })


def homography_sift(img, k1, d1, job_id=None, params=None):
    """
    Compute homography using SIFT features
    """
    if params is None:
        params = {
            'min_matches': 12,
            'ratio_test': 0.75,
            'ransac_threshold': 3.0
        }

    try:
        img_gray = cv.cvtColor(img, cv.COLOR_BGR2GRAY)
        k2, d2 = sift.detectAndCompute(img_gray, None)

        if d2 is None or len(d2) < params['min_matches']:
            if job_id:
                log_message(job_id, f"Not enough features: {len(d2) if d2 is not None else 0}")
            return None

        bf = cv.BFMatcher()
        matches = bf.knnMatch(d1, d2, k=2)

        good = []
        for m_n in matches:
            if len(m_n) == 2:
                m, n = m_n
                if m.distance < params['ratio_test'] * n.distance:
                    good.append(m)

        if len(good) < params['min_matches']:
            if job_id:
                log_message(job_id, f"Not enough good matches: {len(good)}/{params['min_matches']}")
            return None

        if job_id:
            log_message(job_id, f"Found {len(good)} good matches")

        src_pts = np.float32([k1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([k2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

        H, mask = cv.findHomography(
            dst_pts, src_pts,
            method=cv.RANSAC,
            ransacReprojThreshold=params['ransac_threshold'],
            maxIters=5000,
            confidence=0.995
        )

        if H is None:
            return None

        if mask is not None:
            inliers = np.sum(mask)
            inlier_ratio = inliers / len(good)
            if job_id:
                log_message(job_id, f"RANSAC inliers: {inliers}/{len(good)} ({inlier_ratio:.1%})")

            if inlier_ratio < 0.1:
                if job_id:
                    log_message(job_id, f"Low inlier ratio: {inlier_ratio:.1%}")
                return None

        return H

    except Exception as e:
        if job_id:
            log_message(job_id, f"Error in homography_sift: {e}")
        return None


def validate_homography(H, job_id=None):
    """Validate homography matrix"""
    if H is None:
        return False

    try:
        cond = np.linalg.cond(H[:2, :2])
        if cond > 10.0:
            if job_id:
                log_message(job_id, f"High condition number: {cond:.2f}")
            return False

        det = np.linalg.det(H)
        if det < 0.01 or det > 100.0:
            if job_id:
                log_message(job_id, f"Abnormal determinant: {det:.4f}")
            return False

        if abs(H[2, 0]) > 0.01 or abs(H[2, 1]) > 0.01:
            if job_id:
                log_message(job_id, f"Large perspective components")
            return False

        return True

    except Exception as e:
        if job_id:
            log_message(job_id, f"Error validating homography: {e}")
        return False


def warp_and_blend(canvas, img, H, strength=31):
    """Warp and blend image onto canvas"""
    h_canvas, w_canvas = canvas.shape[:2]
    h_img, w_img = img.shape[:2]

    try:
        warped = cv.warpPerspective(img, H, (w_canvas, h_canvas))
        mask = np.ones((h_img, w_img), dtype=np.uint8) * 255
        mask_warped = cv.warpPerspective(mask, H, (w_canvas, h_canvas))

        blend_strength = strength if strength % 2 == 1 else strength + 1
        mask_blur = cv.GaussianBlur(mask_warped, (blend_strength, blend_strength), 0)
        mask_float = mask_blur.astype(np.float32) / 255.0
        mask_float_3ch = cv.cvtColor(mask_float, cv.COLOR_GRAY2BGR)

        canvas_float = canvas.astype(np.float32)
        warped_float = warped.astype(np.float32)

        blended = (canvas_float * (1.0 - mask_float_3ch) + warped_float * mask_float_3ch)
        canvas[:] = np.clip(blended, 0, 255).astype(np.uint8)

    except Exception as e:
        raise Exception(f"Error in warp_and_blend: {e}")


def process_stitching(job_id, overview_path, closeup_paths, params):
    """
    Main stitching processing function (runs in background thread)
    """
    try:
        processing_jobs[job_id]['status'] = 'processing'
        log_message(job_id, 'Starting image stitching process')

        # Load overview image
        log_message(job_id, f'Loading overview image: {overview_path}')
        base = cv.imread(overview_path)
        if base is None:
            raise Exception(f'Failed to read overview image')

        processing_jobs[job_id]['progress'] = 10

        # Prepare canvas
        h_base, w_base = base.shape[:2]
        canvas_scale = params.get('canvas_scale', 2)
        new_w = w_base * canvas_scale
        new_h = h_base * canvas_scale
        canvas = cv.resize(base, (new_w, new_h), interpolation=cv.INTER_CUBIC)

        log_message(job_id, f'Canvas created: {new_w}x{new_h} (scale: {canvas_scale}x)')
        processing_jobs[job_id]['progress'] = 20

        # Compute base SIFT features
        log_message(job_id, 'Computing SIFT features for overview image')
        base_gray = cv.cvtColor(base, cv.COLOR_BGR2GRAY)
        k1, d1 = sift.detectAndCompute(base_gray, None)

        if d1 is None or len(k1) == 0:
            raise Exception('Failed to compute SIFT features from overview image')

        log_message(job_id, f'Found {len(k1)} SIFT keypoints in overview')
        processing_jobs[job_id]['progress'] = 30

        # Scaling matrix
        Hscale = np.array([
            [canvas_scale, 0, 0],
            [0, canvas_scale, 0],
            [0, 0, 1]
        ], dtype=np.float32)

        # Process closeup images
        total_closeups = len(closeup_paths)
        success_count = 0
        skip_count = 0

        sift_params = {
            'min_matches': params.get('sift_min_matches', 12),
            'ratio_test': params.get('sift_ratio_test', 0.75),
            'ransac_threshold': params.get('ransac_threshold', 3.0)
        }

        for idx, path in enumerate(sorted(closeup_paths)):
            filename = os.path.basename(path)
            log_message(job_id, f'Processing [{idx+1}/{total_closeups}]: {filename}')

            img = cv.imread(path)
            if img is None:
                log_message(job_id, f'Failed to read: {filename}')
                skip_count += 1
                continue

            # Compute homography
            H = homography_sift(img, k1, d1, job_id, sift_params)

            if H is None:
                log_message(job_id, f'Skipped (homography failed): {filename}')
                skip_count += 1
                continue

            # Validate homography
            if not validate_homography(H, job_id):
                log_message(job_id, f'Skipped (invalid homography): {filename}')
                skip_count += 1
                continue

            # Blend
            try:
                H_to_canvas = Hscale @ H
                strength = params.get('strength', 31)
                warp_and_blend(canvas, img, H_to_canvas, strength)
                log_message(job_id, f'Blended: {filename}')
                success_count += 1
            except Exception as e:
                log_message(job_id, f'Error blending {filename}: {e}')
                skip_count += 1

            # Update progress
            progress = 30 + int((idx + 1) / total_closeups * 60)
            processing_jobs[job_id]['progress'] = progress

        # Save result
        processing_jobs[job_id]['progress'] = 95
        result_path = os.path.join(app.config['RESULTS_FOLDER'], f'{job_id}.png')
        cv.imwrite(result_path, canvas)

        log_message(job_id, f'Result saved: {result_path}')
        log_message(job_id, f'Processing complete - Success: {success_count}, Skipped: {skip_count}')

        processing_jobs[job_id]['status'] = 'completed'
        processing_jobs[job_id]['progress'] = 100
        processing_jobs[job_id]['result_path'] = result_path
        processing_jobs[job_id]['stats'] = {
            'success_count': success_count,
            'skip_count': skip_count,
            'total_closeups': total_closeups
        }

    except Exception as e:
        log_message(job_id, f'Error: {str(e)}')
        processing_jobs[job_id]['status'] = 'failed'
        processing_jobs[job_id]['error'] = str(e)


@app.route('/')
def index():
    """Serve main UI"""
    return send_file(os.path.join(os.path.dirname(__file__), '..', 'web', 'index.html'))


@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Handle image uploads"""
    try:
        # Check if files are present
        if 'overview' not in request.files:
            return jsonify({'error': 'Overview image is required'}), 400

        if 'closeups' not in request.files:
            return jsonify({'error': 'At least one closeup image is required'}), 400

        # Create job ID
        job_id = str(uuid.uuid4())
        job_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
        os.makedirs(job_dir, exist_ok=True)

        # Save overview
        overview_file = request.files['overview']
        if not allowed_file(overview_file.filename):
            return jsonify({'error': 'Invalid overview file type'}), 400

        overview_filename = secure_filename(overview_file.filename)
        overview_path = os.path.join(job_dir, f'overview_{overview_filename}')
        overview_file.save(overview_path)

        # Save closeups
        closeup_files = request.files.getlist('closeups')
        closeup_paths = []

        for idx, closeup_file in enumerate(closeup_files):
            if not allowed_file(closeup_file.filename):
                continue

            closeup_filename = secure_filename(closeup_file.filename)
            closeup_path = os.path.join(job_dir, f'closeup_{idx:03d}_{closeup_filename}')
            closeup_file.save(closeup_path)
            closeup_paths.append(closeup_path)

        if not closeup_paths:
            return jsonify({'error': 'No valid closeup images uploaded'}), 400

        # Initialize job
        processing_jobs[job_id] = {
            'status': 'uploaded',
            'progress': 0,
            'overview_path': overview_path,
            'closeup_paths': closeup_paths,
            'logs': [],
            'created_at': datetime.now().isoformat()
        }

        return jsonify({
            'job_id': job_id,
            'overview_count': 1,
            'closeup_count': len(closeup_paths)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stitch', methods=['POST'])
def start_stitching():
    """Start stitching process"""
    try:
        data = request.get_json()
        job_id = data.get('job_id')

        if not job_id or job_id not in processing_jobs:
            return jsonify({'error': 'Invalid job ID'}), 400

        if processing_jobs[job_id]['status'] != 'uploaded':
            return jsonify({'error': 'Job already processing or completed'}), 400

        # Get parameters
        params = data.get('params', {})

        # Start processing in background thread
        thread = threading.Thread(
            target=process_stitching,
            args=(
                job_id,
                processing_jobs[job_id]['overview_path'],
                processing_jobs[job_id]['closeup_paths'],
                params
            )
        )
        thread.daemon = True
        thread.start()

        return jsonify({'status': 'started', 'job_id': job_id}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status/<job_id>')
def get_status(job_id):
    """Get job status"""
    if job_id not in processing_jobs:
        return jsonify({'error': 'Job not found'}), 404

    job = processing_jobs[job_id]
    response = {
        'job_id': job_id,
        'status': job['status'],
        'progress': job['progress'],
        'logs': job['logs'][-10:],  # Last 10 logs
    }

    if job['status'] == 'completed':
        response['stats'] = job.get('stats', {})
    elif job['status'] == 'failed':
        response['error'] = job.get('error', 'Unknown error')

    return jsonify(response), 200


@app.route('/api/stream/<job_id>')
def stream_status(job_id):
    """Server-Sent Events stream for real-time updates"""
    def generate():
        last_log_count = 0
        while True:
            if job_id not in processing_jobs:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break

            job = processing_jobs[job_id]

            # Send new logs only
            new_logs = job['logs'][last_log_count:]
            if new_logs:
                for log in new_logs:
                    yield f"data: {json.dumps({'type': 'log', 'data': log})}\n\n"
                last_log_count = len(job['logs'])

            # Send progress update
            yield f"data: {json.dumps({'type': 'progress', 'data': {'progress': job['progress'], 'status': job['status']}})}\n\n"

            if job['status'] in ['completed', 'failed']:
                if job['status'] == 'completed':
                    yield f"data: {json.dumps({'type': 'complete', 'data': job.get('stats', {})})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'data': {'error': job.get('error', 'Unknown error')}})}\n\n"
                break

            time.sleep(0.5)

    return Response(generate(), mimetype='text/event-stream')


@app.route('/api/result/<job_id>')
def get_result(job_id):
    """Get result image"""
    if job_id not in processing_jobs:
        return jsonify({'error': 'Job not found'}), 404

    job = processing_jobs[job_id]

    if job['status'] != 'completed':
        return jsonify({'error': 'Job not completed yet'}), 400

    result_path = job.get('result_path')
    if not result_path or not os.path.exists(result_path):
        return jsonify({'error': 'Result file not found'}), 404

    return send_file(result_path, mimetype='image/png')


@app.route('/api/download/<job_id>')
def download_result(job_id):
    """Download result image"""
    if job_id not in processing_jobs:
        return jsonify({'error': 'Job not found'}), 404

    job = processing_jobs[job_id]

    if job['status'] != 'completed':
        return jsonify({'error': 'Job not completed yet'}), 400

    result_path = job.get('result_path')
    if not result_path or not os.path.exists(result_path):
        return jsonify({'error': 'Result file not found'}), 404

    return send_file(result_path, as_attachment=True, download_name='stitched_result.png')


if __name__ == '__main__':
    print("Starting SIFT Image Stitching API Server...")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Results folder: {RESULTS_FOLDER}")
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
