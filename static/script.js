// script.js (Combined Manual Draw + Haar Fallback - Standard Filenames v6.1)
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileElem');
    const fileNameDisplay = document.getElementById('file-name-display');
    const drawPreviewSection = document.getElementById('draw-preview-section');
    const canvasContainer = document.getElementById('canvas-container');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const clearDrawingsBtn = document.getElementById('clear-drawings-btn');
    const regionCountDisplay = document.getElementById('region-count-display');
    const blurSlider = document.getElementById('blur-slider');
    const blurValueDisplay = document.getElementById('blur-value');
    const processBtn = document.getElementById('process-btn');
    const processingIndicator = document.getElementById('processing-indicator');
    const outputArea = document.getElementById('output-area');
    const downloadArea = document.getElementById('download-area');
    const downloadLink = document.getElementById('download-link');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    // *** FIX: Explicitly select the status label element ***
    const status_label = document.getElementById('status-label'); // Corrected reference

    let currentMediaFile = null;
    let canvas = null;
    let ctx = null;
    let previewImage = null;
    let isDrawing = false;
    let startX, startY;
    let drawnRegions = [];
    let scaleFactor = 1;

    // --- Theme Toggle ---
    // (Unchanged)
    function applyTheme(theme) { body.classList.remove('light-mode', 'dark-mode'); body.classList.add(theme); themeToggleBtn.innerHTML = (theme === 'dark-mode') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; localStorage.setItem('theme', theme); }
    const savedTheme = localStorage.getItem('theme') || 'light-mode'; applyTheme(savedTheme);
    themeToggleBtn.addEventListener('click', () => { const newTheme = body.classList.contains('dark-mode') ? 'light-mode' : 'dark-mode'; applyTheme(newTheme); });

    // --- Blur Slider ---
    blurSlider.addEventListener('input', () => { blurValueDisplay.textContent = parseFloat(blurSlider.value).toFixed(2); });

    // --- Drag and Drop ---
     // (Unchanged)
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropArea.addEventListener(eventName, preventDefaults, false); document.body.addEventListener(eventName, preventDefaults, false); });
    ['dragenter', 'dragover'].forEach(eventName => { dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false); });
    ['dragleave', 'drop'].forEach(eventName => { dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false); });
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);
    function handleDrop(e) { const files = e.dataTransfer.files; if (files.length > 0) { handleMediaFile(files[0]); } }
    function handleFileSelect(e) { if (e.target.files.length > 0) { handleMediaFile(e.target.files[0]); } }

    function handleMediaFile(file) {
         // (Unchanged)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/flv'];
        let isAllowed = allowedTypes.includes(file.type) || file.type.startsWith('image/') || file.type.startsWith('video/');
        if (!isAllowed) { alert(`Unsupported file type: ${file.type || 'unknown'}.`); resetAllStates(); return; }
        const maxSizeMB = 100; const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) { alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size: ${maxSizeMB} MB.`); resetAllStates(); return; }
        currentMediaFile = file;
        fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        setupCanvasForPreview(file);
        outputArea.innerHTML = '<p>Processed output will appear here.</p>';
        downloadArea.style.display = 'none';
        processingIndicator.style.display = 'none';
        processBtn.disabled = false;
    }

    // --- Canvas Setup and Drawing ---
     // (Unchanged)
    function setupCanvasForPreview(file) { clearCanvasAndRegions(); previewPlaceholder.style.display = 'none'; drawPreviewSection.style.display = 'block'; const reader = new FileReader(); reader.onload = (e) => { if (file.type.startsWith('image/')) { previewImage = new Image(); previewImage.onload = () => { initializeCanvas(previewImage.naturalWidth, previewImage.naturalHeight); redrawCanvas(); } ; previewImage.onerror = previewLoadError; previewImage.src = e.target.result; } else if (file.type.startsWith('video/')) { previewImage = document.createElement('video'); previewImage.onloadedmetadata = () => { initializeCanvas(previewImage.videoWidth, previewImage.videoHeight); redrawCanvas(); }; previewImage.onerror = previewLoadError; previewImage.oncanplay = () => { if (!canvas) { initializeCanvas(previewImage.videoWidth, previewImage.videoHeight); redrawCanvas(); } }; previewImage.muted = true; previewImage.src = e.target.result; previewImage.load(); } }; reader.onerror = previewLoadError; reader.readAsDataURL(file); }
    function previewLoadError(e) { console.error("Error loading preview media:", e); canvasContainer.innerHTML = '<p style="color: red;">Could not load preview for drawing.</p>'; previewPlaceholder.style.display = 'none'; canvas = null; ctx = null; previewImage = null; drawnRegions = []; }
    function initializeCanvas(originalWidth, originalHeight) { if (canvas) { canvas.remove(); } canvas = document.createElement('canvas'); const containerWidth = canvasContainer.clientWidth > 0 ? canvasContainer.clientWidth - 20 : 500; const containerHeight = 450; let displayWidth = originalWidth; let displayHeight = originalHeight; scaleFactor = 1; if (originalWidth > containerWidth) { scaleFactor = containerWidth / originalWidth; displayWidth = containerWidth; displayHeight = originalHeight * scaleFactor; } if (displayHeight > containerHeight) { scaleFactor = containerHeight / originalHeight; displayWidth = originalWidth * scaleFactor; displayHeight = containerHeight; } canvas.width = displayWidth; canvas.height = displayHeight; canvasContainer.appendChild(canvas); ctx = canvas.getContext('2d'); console.log(`Canvas initialized. Original: ${originalWidth}x${originalHeight}, Display: ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)}, Scale: ${scaleFactor.toFixed(3)}`); canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseleave', stopDraw); canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDraw); canvas.addEventListener('touchcancel', stopDraw); }
    function redrawCanvas() { if (!canvas || !ctx || !previewImage) return; ctx.clearRect(0, 0, canvas.width, canvas.height); try { if (previewImage instanceof HTMLImageElement || (previewImage instanceof HTMLVideoElement && previewImage.readyState >= 2)) { ctx.drawImage(previewImage, 0, 0, canvas.width, canvas.height); } } catch (e) { console.error("Error drawing base image/frame:", e); } ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; drawnRegions.forEach(rect => { ctx.fillRect(rect.x * scaleFactor, rect.y * scaleFactor, rect.w * scaleFactor, rect.h * scaleFactor); ctx.strokeRect(rect.x * scaleFactor, rect.y * scaleFactor, rect.w * scaleFactor, rect.h * scaleFactor); }); if (isDrawing && currentRect) { ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h); ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h); } updateRegionCountDisplay(); }
    let currentRect = null;
    function getCanvasPos(evt) { if(!canvas) return null; const rect = canvas.getBoundingClientRect(); const clientX = evt.clientX ?? evt.touches?.[0]?.clientX; const clientY = evt.clientY ?? evt.touches?.[0]?.clientY; if (clientX === undefined || clientY === undefined) return null; return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }; }
    function startDraw(e) { if (!canvas || !ctx) return; isDrawing = true; const pos = getCanvasPos(e); if (!pos) { isDrawing = false; return; } startX = pos.x; startY = pos.y; currentRect = { x: startX, y: startY, w: 0, h: 0 }; e.preventDefault(); }
    function draw(e) { if (!isDrawing || !canvas || !ctx) return; const pos = getCanvasPos(e); if (!pos) return; const currentX = pos.x; const currentY = pos.y; currentRect.x = Math.min(startX, currentX); currentRect.y = Math.min(startY, currentY); currentRect.w = Math.abs(startX - currentX); currentRect.h = Math.abs(startY - currentY); redrawCanvas(); e.preventDefault(); }
    function stopDraw(e) { if (!isDrawing || !currentRect) return; isDrawing = false; if (currentRect.w > 5 && currentRect.h > 5) { const originalX = Math.round(currentRect.x / scaleFactor); const originalY = Math.round(currentRect.y / scaleFactor); const originalW = Math.round(currentRect.w / scaleFactor); const originalH = Math.round(currentRect.h / scaleFactor); drawnRegions.push({ x: originalX, y: originalY, w: originalW, h: originalH }); console.log("Region Added (Original Coords):", drawnRegions[drawnRegions.length-1]); } else { console.log("Region too small, discarded."); } currentRect = null; redrawCanvas(); }
    clearDrawingsBtn.addEventListener('click', clearCanvasAndRegions);
    function clearCanvasAndRegions() { drawnRegions = []; currentRect = null; isDrawing = false; redrawCanvas(); }
    function updateRegionCountDisplay() { regionCountDisplay.textContent = `Regions drawn: ${drawnRegions.length}`; }

    // --- Reset Function ---
     function resetAllStates() {
        currentMediaFile = null; fileNameDisplay.textContent = 'No file selected'; fileInput.value = '';
        clearCanvasAndRegions(); if(canvas) canvas.remove(); canvas = null; ctx = null; previewImage = null;
        previewPlaceholder.style.display = 'block'; drawPreviewSection.style.display = 'none';
        outputArea.innerHTML = '<p>Processed output will appear here.</p>'; downloadArea.style.display = 'none';
        processingIndicator.style.display = 'none'; processBtn.disabled = true;
        setControlsState(false); // Re-enable controls
        if (status_label) status_label.textContent = "Ready. Load media."; // Reset status bar
     }

     // --- Processing ---
    processBtn.addEventListener('click', () => {
        if (!currentMediaFile) { alert('Please select an image or video file first.'); return; }
        processingIndicator.style.display = 'block'; outputArea.innerHTML = ''; downloadArea.style.display = 'none';
        processBtn.disabled = true; setControlsState(true);
        // Update status label during processing start
        if (status_label) status_label.textContent = "Processing started...";

        const formData = new FormData(); formData.append('file', currentMediaFile); formData.append('blurFactor', blurSlider.value);
        const regionsToSend = drawnRegions.map(r => [r.x, r.y, r.w, r.h]);
        formData.append('manualRegions', JSON.stringify(regionsToSend));
        console.log("Sending manual regions:", JSON.stringify(regionsToSend));

        fetch('/process', { method: 'POST', body: formData })
        .then(response => {
            if (!response.ok) { return response.json().then(errData => { throw new Error(errData.error || `Server error: ${response.statusText}`); }).catch(() => { throw new Error(`Server error: ${response.statusText} (${response.status})`); }); }
            return response.json();
        })
        .then(data => {
            processingIndicator.style.display = 'none';
            if (data.success) {
                displayResult(data.url, data.is_video); downloadLink.href = data.url; downloadLink.download = `blurred_${currentMediaFile.name}`; downloadArea.style.display = 'block';
                const methodInfo = data.method_used ? ` (${data.method_used})` : '';
                const successMsg = `Processing complete${methodInfo}. ${data.regions_processed} region(s) blurred in ${data.processing_time}s.`;
                // *** FIX: Update status label on success ***
                if (status_label) status_label.textContent = successMsg;
                console.log(successMsg); // Also log to console
                setControlsState(false); processBtn.disabled = false; // Re-enable process if file still loaded
            } else {
                const errorMsg = `Error: ${data.error}`;
                outputArea.innerHTML = `<p style="color: red;">${errorMsg}</p>`;
                // *** FIX: Update status label on failure ***
                if (status_label) status_label.textContent = `Processing failed: ${data.error}`;
                setControlsState(false); processBtn.disabled = true;
            }
        })
        .catch(error => {
            console.error('Error processing file:', error);
            processingIndicator.style.display = 'none';
            const errorMsg = `An error occurred: ${error.message}. Check console.`;
            outputArea.innerHTML = `<p style="color: red;">${errorMsg}</p>`;
             // *** FIX: Update status label on network/fetch error ***
            if (status_label) status_label.textContent = `Error: ${error.message}`;
            setControlsState(false); processBtn.disabled = true;
        });
    });

    // Helper to enable/disable specific controls during processing
     function setControlsState(disabled) {
        // References to potentially disable
        const fileInputElement = document.getElementById('fileElem');
        const processButtonElement = document.getElementById('process-btn');
        const dropAreaElement = document.getElementById('drop-area');
        const blurSliderElement = document.getElementById('blur-slider');
        const clearDrawingsButtonElement = document.getElementById('clear-drawings-btn');
        const btnLoadImageElement = document.querySelector('#upload-section .browse-btn'); // May need adjustment if you have separate buttons

        // Toggle disabled state
        if(fileInputElement) fileInputElement.disabled = disabled;
        if(processButtonElement) processButtonElement.disabled = disabled; // This is primarily controlled by file/model state too
        if(dropAreaElement) { dropAreaElement.style.opacity = disabled ? '0.6' : '1'; dropAreaElement.style.cursor = disabled ? 'not-allowed' : 'pointer'; dropAreaElement.style.pointerEvents = disabled ? 'none' : 'auto'; }
        if(blurSliderElement) blurSliderElement.disabled = disabled;
        if(clearDrawingsButtonElement) clearDrawingsButtonElement.disabled = disabled;
        // Disable media upload buttons if they exist and are separate
        // if(btnLoadImageElement) btnLoadImageElement.disabled = disabled; // Example if you have separate load buttons
     }

    function displayResult(url, isVideo) {
        // (Unchanged)
        outputArea.innerHTML = '';
        if (isVideo) { const video = document.createElement('video'); video.controls = true; video.style.maxWidth = '100%'; video.style.maxHeight = '500px'; const source = document.createElement('source'); source.src = url; const extension = url.split('.').pop().toLowerCase(); source.type = (['mp4', 'webm', 'ogg'].includes(extension)) ? `video/${extension}` : 'video/mp4'; video.appendChild(source); outputArea.appendChild(video); }
        else { const img = document.createElement('img'); img.src = url; img.alt = 'Processed Image'; outputArea.appendChild(img); }
    }

}); // End DOMContentLoaded