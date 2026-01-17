const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('fileName');
const bgThresholdInput = document.getElementById('bgThreshold');
const bgThresholdValue = document.getElementById('bgThresholdValue');
const processBtn = document.getElementById('processBtn');

processBtn.addEventListener('click', () => {
    alert("Grid Generation (SVG Export) will be implemented in Phase 3.");
});

const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const gridWidthInput = document.getElementById('gridWidth');
const gridHeightInput = document.getElementById('gridHeight');
const aspectRatioBtn = document.getElementById('aspectRatioBtn');

// Offscreen canvas for original image processing
const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d');

let originalImage = null;
let isAspectRatioLocked = true;
let currentAspectRatio = 1;

// Event Listeners
imageUpload.addEventListener('change', handleImageUpload);
bgThresholdInput.addEventListener('input', updateThresholdDisplay);
bgThresholdInput.addEventListener('change', () => {
    if (originalImage) processImage();
});

// Grid Dimension Listeners
gridWidthInput.addEventListener('input', (e) => handleDimensionChange(e, 'width'));
gridHeightInput.addEventListener('input', (e) => handleDimensionChange(e, 'height'));
// Ensure manual changes (without aspect lock or just discrete changes) also trigger update
gridWidthInput.addEventListener('change', () => { if (originalImage) processImage(); });
gridHeightInput.addEventListener('change', () => { if (originalImage) processImage(); });

aspectRatioBtn.addEventListener('click', toggleAspectRatioLock);

function toggleAspectRatioLock() {
    isAspectRatioLocked = !isAspectRatioLocked;
    aspectRatioBtn.classList.toggle('active', isAspectRatioLocked);

    // Sync if locking
    if (isAspectRatioLocked) {
        const w = parseInt(gridWidthInput.value) || 32;
        gridHeightInput.value = Math.round(w / currentAspectRatio);
    }
}

function handleDimensionChange(e, type) {
    if (!isAspectRatioLocked) return;

    const val = parseInt(e.target.value);
    if (!val) return;

    if (type === 'width') {
        gridHeightInput.value = Math.max(1, Math.round(val / currentAspectRatio));
    } else {
        gridWidthInput.value = Math.max(1, Math.round(val * currentAspectRatio));
    }

    // Re-process to update the preview with new dimensions
    if (originalImage) processImage();
}

function updateThresholdDisplay(e) {
    bgThresholdValue.textContent = e.target.value;
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            // Enable controls
            processBtn.disabled = false;
            emptyState.style.display = 'none';
            mainCanvas.style.display = 'block';

            // Initial Processing
            processImage();
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function processImage() {
    if (!originalImage) return;

    // 1. Draw original to work canvas
    workCanvas.width = originalImage.width;
    workCanvas.height = originalImage.height;
    workCtx.drawImage(originalImage, 0, 0);

    const imageData = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const data = imageData.data;
    const threshold = parseInt(bgThresholdInput.value, 10);

    // 2. Sample Top-Left Pixel (Background Reference)
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    // Variables for bounding box
    let minX = workCanvas.width, maxX = 0;
    let minY = workCanvas.height, maxY = 0;
    let hasContent = false;

    // 3. Loop through pixels
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Euclidean distance
        const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

        if (dist < threshold) {
            data[i + 3] = 0; // Make transparent
        } else {
            // It's part of the subject (if it wasn't already transparent)
            if (a > 0) {
                const pixelIndex = i / 4;
                const x = pixelIndex % workCanvas.width;
                const y = Math.floor(pixelIndex / workCanvas.width);

                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasContent = true;
            }
        }
    }

    // 4. Auto-Crop & Display
    if (hasContent) {
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        // Resize main canvas to fit the cropped content
        mainCanvas.width = width;
        mainCanvas.height = height;

        workCtx.putImageData(imageData, 0, 0);

        // --- Pixelation Preview Logic ---
        const gridW = parseInt(gridWidthInput.value) || 32;
        const gridH = parseInt(gridHeightInput.value) || 32;

        // Create a tiny canvas for the pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = gridW;
        tempCanvas.height = gridH;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the cropped high-res image into the tiny canvas (Downsampling)
        // We act on the cropped region from workCanvas: (minX, minY) size (width, height)
        tempCtx.drawImage(workCanvas, minX, minY, width, height, 0, 0, gridW, gridH);

        // Draw the tiny image back to the main canvas (Upsampling with nearest-neighbor)
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        ctx.drawImage(tempCanvas, 0, 0, gridW, gridH, 0, 0, mainCanvas.width, mainCanvas.height);

        // Update Aspect Ratio Logic
        currentAspectRatio = width / height;

        // Update Grid Height based on current Width if locked
        if (isAspectRatioLocked) {
            const currentW = parseInt(gridWidthInput.value) || 32;
            gridHeightInput.value = Math.max(1, Math.round(currentW / currentAspectRatio));
        }

    } else {
        // If everything is removed, clear canvas
        mainCanvas.width = originalImage.width;
        mainCanvas.height = originalImage.height;
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    }
}
