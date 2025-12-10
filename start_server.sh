#!/bin/bash

echo "========================================"
echo "SIFT Image Stitching Tool - Web Server"
echo "========================================"
echo ""

echo "Checking Python installation..."
python3 --version
if [ $? -ne 0 ]; then
    echo "ERROR: Python 3 is not installed or not in PATH"
    exit 1
fi

echo ""
echo "Starting Flask development server..."
echo "Open your browser to: http://localhost:5000"
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"
python3 src/api.py
