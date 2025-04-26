# app_haar.py (v6.1 - Added Template Folder Debug Print)
import os
import time
import traceback
import uuid
from flask import Flask, request, render_template, jsonify, send_from_directory, url_for, current_app
from werkzeug.utils import secure_filename
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
UPLOAD_FOLDER_NAME = 'uploads'
ALLOWED_EXTENSIONS_IMG = {'png', 'jpg', 'jpeg', 'webp'}
ALLOWED_EXTENSIONS_VID = {'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'}

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER_PATH = os.path.join(BASE_DIR, UPLOAD_FOLDER_NAME)

MAX_UPLOAD_MB = 100
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', MAX_UPLOAD_MB * 1024 * 1024))
print(f"INFO: Maximum upload size set to: {MAX_CONTENT_LENGTH / (1024*1024):.0f} MB")

HAAR_CASCADE_FILENAME = 'haarcascade_frontalface_default.xml'
HAAR_SCALE_FACTOR = 1.1
HAAR_MIN_NEIGHBORS = 5
HAAR_MIN_SIZE = (30, 30)

# --- Flask App Setup ---
# Flask by default looks for a folder named 'templates'
# located in the same directory as the script where Flask(__name__) is called.
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER_PATH
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_different_default_secret_key_haar_v3') # Change this!

# --- Global Variable for Haar Cascade Model ---
haar_cascade = None

# --- Helper Functions ---
def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def load_haar_cascade_on_startup(cascade_filename):
    global haar_cascade
    cascade_path = os.path.join(BASE_DIR, cascade_filename)
    if not os.path.exists(cascade_path):
        print(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"CRITICAL ERROR: Haar Cascade file '{cascade_filename}' not found at expected location: {cascade_path}")
        print(f"      Please download it and place it in the same directory as this script ({BASE_DIR}).")
        print(f"      Download Link: https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml")
        print(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        return False
    try:
        haar_cascade = cv2.CascadeClassifier(cascade_path)
        if haar_cascade.empty():
            print(f"ERROR: Failed to load Haar Cascade from {cascade_path} (file might be invalid)."); haar_cascade = None; return False
        print(f"INFO: Haar Cascade '{cascade_filename}' loaded successfully.")
        return True
    except Exception as e: print(f"ERROR loading Haar Cascade from {cascade_path}: {e}"); traceback.print_exc(); haar_cascade = None; return False

def detect_faces_haar(frame):
    global haar_cascade
    if haar_cascade is None: raise RuntimeError("Haar Cascade model is not loaded.")
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY); gray = cv2.equalizeHist(gray)
        faces = haar_cascade.detectMultiScale(gray, scaleFactor=HAAR_SCALE_FACTOR, minNeighbors=HAAR_MIN_NEIGHBORS, minSize=HAAR_MIN_SIZE)
        return faces if isinstance(faces, np.ndarray) else np.empty((0, 4))
    except Exception as e: print(f"ERROR during Haar Cascade detection: {e}"); traceback.print_exc(); return np.empty((0, 4))

def blur_regions(frame, regions, blur_factor):
    # (Unchanged)
    processed_frame = frame.copy();
    try: regions_array = np.array(regions).astype(int)
    except (ValueError, TypeError): print("Warning: Could not convert regions to integer array."); return processed_frame
    if not isinstance(regions_array, np.ndarray) or regions_array.ndim != 2 or regions_array.shape[1] < 4 or len(regions_array) == 0: return processed_frame
    for region in regions_array:
        x, y, w, h = region[:4];
        if w <= 0 or h <= 0: continue
        y1=max(0, y); y2=min(frame.shape[0], y + h); x1=max(0, x); x2=min(frame.shape[1], x + w)
        if y2 <= y1 or x2 <= x1: continue
        roi = processed_frame[y1:y2, x1:x2]
        if roi.size == 0: continue
        base_kernel_dim = max(int(min(w, h) * blur_factor * 0.5), 7)
        kernel_size = base_kernel_dim // 2 * 2 + 1; kernel_size = max(5, kernel_size)
        try: blurred_roi = cv2.GaussianBlur(roi, (kernel_size, kernel_size), sigmaX=0, sigmaY=0); processed_frame[y1:y2, x1:x2] = blurred_roi
        except cv2.error as e: print(f"Warn: Blur failed. ROI:{roi.shape} K:({kernel_size},{kernel_size}) Err:{e}"); continue
    return processed_frame

def process_uploaded_image(input_path, output_path, blur_factor):
    # (Unchanged)
    print(f"--- Processing Image: {os.path.basename(input_path)} ---")
    try:
        img = cv2.imread(input_path);
        if img is None: raise IOError(f"Could not read input image file: {input_path}")
        detected_faces = detect_faces_haar(img)
        print(f" INFO: Detected {len(detected_faces)} face regions (Haar).")
        blurred_img = blur_regions(img, detected_faces, blur_factor)
        success = cv2.imwrite(output_path, blurred_img);
        if not success: raise IOError(f"Could not write processed image to: {output_path}")
        print(f" INFO: Processed image saved to: {output_path}")
        return True
    except Exception as e: print(f"ERROR processing image {input_path}: {e}"); traceback.print_exc(); return False

def process_uploaded_video(input_path, output_path, blur_factor):
     # (Unchanged)
    print(f"--- Processing Video: {os.path.basename(input_path)} ---")
    cap = None; out = None
    try:
        cap = cv2.VideoCapture(input_path);
        if not cap.isOpened(): raise IOError(f"Cannot open video file: {input_path}")
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS);
        if fps <= 0 or fps > 120: print(f"Warning: Invalid FPS {fps} detected, setting to 30."); fps = 30
        fourcc = cv2.VideoWriter_fourcc(*'mp4v'); print(f" INFO: Input video properties: {frame_width}x{frame_height} @ {fps:.2f} FPS")
        out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height));
        if not out.isOpened(): raise IOError(f"Could not open VideoWriter for path: {output_path}")
        frame_count = 0; total_detections = 0; start_time = time.time()
        while True:
            ret, frame = cap.read();
            if not ret: break
            frame_count += 1
            detected_faces = detect_faces_haar(frame)
            num_detected = len(detected_faces); total_detections += num_detected
            processed_frame = blur_regions(frame, detected_faces, blur_factor) if num_detected > 0 else frame
            out.write(processed_frame)
            if frame_count % 60 == 0:
                 elapsed = time.time() - start_time; current_fps = frame_count / elapsed if elapsed > 0 else 0
                 print(f"  INFO: Processed frame {frame_count}... ({current_fps:.1f} FPS)")
        end_time = time.time()
        print(f"INFO: Finished processing video. Total frames: {frame_count}, Total face detections: {total_detections}")
        print(f"INFO: Output video saved to: {output_path}"); print(f"INFO: Processing time: {end_time - start_time:.2f} seconds")
        return True
    except Exception as e: print(f"ERROR processing video {input_path}: {e}"); traceback.print_exc(); return False
    finally:
        if cap and cap.isOpened(): cap.release(); print(" INFO: VideoCapture released.")
        if out and out.isOpened(): out.release(); print(" INFO: VideoWriter released.")

# --- Flask Routes ---
@app.route('/', methods=['GET'])
def index():
    """Renders the main HTML page."""
    print(f"INFO: Request for '/'. Attempting to render 'index_haar.html'.")
    # --- Add Debug Print ---
    # This will show the absolute path where Flask *thinks* the templates folder is.
    # Make sure this path matches where your 'templates' folder actually is.
    print(f"DEBUG: Flask app root path: {app.root_path}")
    print(f"DEBUG: Flask template folder path: {app.template_folder}")
    # --- End Debug Print ---
    try:
        return render_template('index_haar.html') # Ensure this filename matches exactly
    except Exception as e:
        print(f"CRITICAL ERROR rendering template 'index_haar.html': {e}")
        traceback.print_exc()
        # Provide a more informative error if template fails
        return f"Internal Server Error: Could not render template 'index_haar.html'. Check server logs and ensure the file exists in the '{app.template_folder}' directory.", 500


@app.route('/process', methods=['POST'])
def process_file():
    """Handles media file upload, processing, and returns result info."""
    # (Unchanged)
    print("INFO: Received request for /process")
    global haar_cascade
    if haar_cascade is None: print("ERROR: Processing attempted but Haar Cascade is not loaded."); return jsonify({"success": False, "error": "Face detector not loaded."}), 503
    if 'file' not in request.files: print("ERROR: 'file' not in request.files"); return jsonify({"success": False, "error": "No file part."}), 400
    file = request.files['file']
    try:
        blur_factor = float(request.form.get('blurFactor', 0.4));
        if not (0.05 <= blur_factor <= 1.0): raise ValueError("Invalid blur factor")
    except ValueError: blur_factor = 0.4; print("WARN: Using default blur factor 0.4")
    if file.filename == '': print("ERROR: No file selected."); return jsonify({"success": False, "error": "No file selected."}), 400
    filename = secure_filename(file.filename); file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    is_image = file_ext in ALLOWED_EXTENSIONS_IMG; is_video = file_ext in ALLOWED_EXTENSIONS_VID
    if not is_image and not is_video: print(f"ERROR: Invalid file type '{file_ext}'."); return jsonify({"success": False, "error": f"Invalid file type '{file_ext}'."}), 415
    try: os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    except OSError as e: print(f"Error creating upload dir: {e}"); return jsonify({"success": False, "error": "Server directory error."}), 500
    unique_id = uuid.uuid4().hex; input_filename = f"{unique_id}_input.{file_ext}"
    output_ext = 'mp4' if is_video else file_ext; output_filename = f"{unique_id}_blurred_haar.{output_ext}"
    input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], input_filename)
    output_path = os.path.join(current_app.config['UPLOAD_FOLDER'], output_filename)
    success = False
    try:
        file.save(input_path); print(f"INFO: Uploaded media saved to: {input_path}")
        start_time = time.time()
        if is_image: success = process_uploaded_image(input_path, output_path, blur_factor)
        elif is_video: success = process_uploaded_video(input_path, output_path, blur_factor)
        end_time = time.time()
        if success:
             print("SUCCESS: Processing complete.")
             return jsonify({ "success": True, "filename": output_filename, "url": url_for('uploaded_file', filename=output_filename), "is_video": is_video, "processing_time": f"{end_time - start_time:.2f}" }), 200
        else: print("ERROR: Processing function returned failure."); return jsonify({"success": False, "error": "Processing failed internally. See server logs."}), 500
    except Exception as e:
        print(f"ERROR: Exception during file processing route: {e}"); traceback.print_exc()
        return jsonify({"success": False, "error": f"Internal server error: {e}"}), 500
    finally:
        if os.path.exists(input_path):
            try: os.remove(input_path); print(f"INFO: Removed input file: {input_path}")
            except Exception as e_rem: print(f"WARNING: Could not remove input file {input_path}: {e_rem}")


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serves processed files from the upload directory."""
    # (Unchanged)
    safe_dir = os.path.abspath(current_app.config['UPLOAD_FOLDER'])
    safe_path = os.path.abspath(os.path.join(safe_dir, filename))
    if not safe_path.startswith(safe_dir): print(f"WARN: Forbidden access attempt: {filename}"); return "Forbidden", 403
    try:
        print(f"INFO: Serving file: {filename} from {safe_dir}")
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename, as_attachment=False)
    except FileNotFoundError: print(f"ERROR: File not found requested: {filename}"); return "File not found", 404
    except Exception as e: print(f"ERROR serving file {filename}: {e}"); traceback.print_exc(); return "Error serving file", 500

# --- Main Execution ---
if __name__ == '__main__':
    print("Starting Flask Face Blur Application (OpenCV Haar Cascade Version)...")
    os.makedirs(UPLOAD_FOLDER_PATH, exist_ok=True); print(f"INFO: Upload folder ensured at: {UPLOAD_FOLDER_PATH}")
    model_loaded = load_haar_cascade_on_startup(HAAR_CASCADE_FILENAME)
    if not model_loaded: print("\n!!! WARNING: Haar Cascade model failed to load. Processing will not work. !!!\n")
    app.run(debug=os.environ.get('FLASK_DEBUG', 'False').lower() == 'true', host='0.0.0.0', port=5000)