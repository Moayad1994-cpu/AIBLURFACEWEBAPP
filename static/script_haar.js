// script_v_haar.js (For OpenCV Haar Cascade App)
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileElem');
    const fileNameDisplay = document.getElementById('file-name-display');
    const previewSection = document.getElementById('preview-section');
    const previewArea = document.getElementById('preview-area');
    const blurSlider = document.getElementById('blur-slider');
    const blurValueDisplay = document.getElementById('blur-value');
    const processBtn = document.getElementById('process-btn');
    const processingIndicator = document.getElementById('processing-indicator');
    const outputArea = document.getElementById('output-area');
    const downloadArea = document.getElementById('download-area');
    const downloadLink = document.getElementById('download-link');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    let currentMediaFile = null; // Holds the currently selected image/video file

    // --- Theme Toggle ---
    function applyTheme(theme) {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(theme);
        themeToggleBtn.innerHTML = (theme === 'dark-mode') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', theme);
    }
    const savedTheme = localStorage.getItem('theme') || 'light-mode'; // Default to light
    applyTheme(savedTheme); // Apply saved or default theme on load

    themeToggleBtn.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light-mode' : 'dark-mode';
        applyTheme(newTheme);
    });

    // --- Blur Slider ---
    blurSlider.addEventListener('input', () => {
        blurValueDisplay.textContent = parseFloat(blurSlider.value).toFixed(2);
    });

    // --- Drag and Drop ---
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) { const files = e.dataTransfer.files; if (files.length > 0) { handleMediaFile(files[0]); } }
    function handleFileSelect(e) { if (e.target.files.length > 0) { handleMediaFile(e.target.files[0]); } }

    function handleMediaFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/flv'];
        let isAllowed = allowedTypes.includes(file.type) || file.type.startsWith('image/') || file.type.startsWith('video/');

        if (!isAllowed) {
            alert(`Unsupported file type: ${file.type || 'unknown'}. Please upload common image or video formats.`);
            resetMediaUploadState(); return;
        }
        const maxSizeMB = 100; // Client-side check limit (adjust if needed)
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) { alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${maxSizeMB} MB.`); resetMediaUploadState(); return; }

        currentMediaFile = file;
        fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        displayPreview(file); // Show preview
        // Clear previous result area
        outputArea.innerHTML = '<p>Processed output will appear here.</p>';
        downloadArea.style.display = 'none';
        processingIndicator.style.display = 'none';
        processBtn.disabled = false; // Enable process button
    }

    function displayPreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = ''; // Clear previous preview
            try {
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = "Image Preview";
                    previewArea.appendChild(img);
                } else if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = e.target.result;
                    video.controls = true; // Add controls for preview
                    video.muted = true; // Mute preview by default
                    previewArea.appendChild(video);
                } else { // Fallback for unexpected types that passed initial check
                     previewArea.innerHTML = `<p>Cannot preview this file type (${file.type}).</p>`;
                }
                 previewSection.style.display = 'block'; // Show the preview section
            } catch (error) {
                 console.error("Error creating preview element:", error);
                 previewArea.innerHTML = '<p style="color: red;">Could not generate preview.</p>';
                 previewSection.style.display = 'block';
            }
        }
        reader.onerror = function(e) {
            console.error("FileReader error:", e);
            previewArea.innerHTML = '<p style="color: red;">Could not read file for preview.</p>';
            previewSection.style.display = 'block';
        }
         if (file) {
            reader.readAsDataURL(file); // Read file as Data URL for embedding
         } else {
             previewArea.innerHTML = '<p>No file to preview.</p>';
              previewSection.style.display = 'block';
         }
    }

     function resetMediaUploadState() {
        currentMediaFile = null;
        fileNameDisplay.textContent = 'No file selected';
        fileInput.value = '';
        previewArea.innerHTML = '<p>Upload a file to see a preview.</p>';
        previewSection.style.display = 'none';
        outputArea.innerHTML = '<p>Processed output will appear here.</p>';
        downloadArea.style.display = 'none';
        processBtn.disabled = true; // Disable process button when cleared
    }

     // Helper to enable/disable controls during processing
     function setControlsState(disabled) {
        // Disable/Enable file input and process button
        if(fileInput) fileInput.disabled = disabled; // Check if element exists
        if(processBtn) processBtn.disabled = disabled;
        // Visually indicate disabled state on drop area
        if(dropArea) {
            dropArea.style.opacity = disabled ? '0.6' : '1';
            dropArea.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
        // Also disable slider
        if(blurSlider) blurSlider.disabled = disabled;
     }


    // --- Processing ---
    processBtn.addEventListener('click', () => {
        if (!currentMediaFile) { alert('Please select an image or video file first.'); return; }

        processingIndicator.style.display = 'block'; // Show spinner
        outputArea.innerHTML = ''; // Clear previous result output
        downloadArea.style.display = 'none';
        setControlsState(true); // Disable controls

        const formData = new FormData();
        formData.append('file', currentMediaFile);
        formData.append('blurFactor', blurSlider.value);

        fetch('/process', { method: 'POST', body: formData })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => { throw new Error(errData.error || `Server error: ${response.statusText}`); })
                 .catch(() => { throw new Error(`Server error: ${response.statusText} (${response.status})`); });
            }
            return response.json();
        })
        .then(data => {
            processingIndicator.style.display = 'none';
            if (data.success) {
                displayResult(data.url, data.is_video);
                downloadLink.href = data.url;
                downloadLink.download = `blurred_haar_${currentMediaFile.name}`; // Suggest download name
                downloadArea.style.display = 'block';
                console.log(`Processing finished in ${data.processing_time} seconds.`);
                setControlsState(false); // Re-enable controls
                processBtn.disabled = false; // Explicitly re-enable process button
            } else {
                outputArea.innerHTML = `<p style="color: red;">Error: ${data.error}</p>`;
                setControlsState(false); // Re-enable controls on error
                // Keep processBtn disabled if the underlying media file might still be selected but processing failed
                // If you want the user to re-upload, call resetMediaUploadState() here instead.
                processBtn.disabled = !currentMediaFile;
            }
        })
        .catch(error => {
            console.error('Error processing file:', error);
            processingIndicator.style.display = 'none';
            setControlsState(false); // Re-enable controls on error
            outputArea.innerHTML = `<p style="color: red;">An error occurred: ${error.message}. Check console.</p>`;
            processBtn.disabled = true; // Keep process disabled on fetch/network error
        });
    });

    function displayResult(url, isVideo) {
        outputArea.innerHTML = ''; // Clear placeholder
        if (isVideo) {
            const video = document.createElement('video'); video.controls = true; video.style.maxWidth = '100%'; video.style.maxHeight = '500px';
            const source = document.createElement('source'); source.src = url;
            const extension = url.split('.').pop().toLowerCase(); source.type = (['mp4', 'webm', 'ogg'].includes(extension)) ? `video/${extension}` : 'video/mp4';
            video.appendChild(source); outputArea.appendChild(video);
        } else { const img = document.createElement('img'); img.src = url; img.alt = 'Processed Image'; outputArea.appendChild(img); }
    }

}); // End DOMContentLoaded