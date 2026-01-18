const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('fileName');
const bgThresholdInput = document.getElementById('bgThreshold');
const bgThresholdValue = document.getElementById('bgThresholdValue');
const processBtn = document.getElementById('processBtn');

processBtn.addEventListener('click', generateSVG);

const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const gridWidthInput = document.getElementById('gridWidth');
const gridHeightInput = document.getElementById('gridHeight');
const aspectRatioBtn = document.getElementById('aspectRatioBtn');
const colorCountInput = document.getElementById('colorCount');
const colorCountValue = document.getElementById('colorCountValue');

// Offscreen canvas for original image processing
const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d');

let originalImage = null;
let isAspectRatioLocked = true;
let currentAspectRatio = 1;
let lastProcessedData = null;
let uploadedFileName = "pixel-art";

// Event Listeners
imageUpload.addEventListener('change', handleImageUpload);
bgThresholdInput.addEventListener('input', updateThresholdDisplay);
bgThresholdInput.addEventListener('change', () => {
    if (originalImage) processImage();
});

colorCountInput.addEventListener('input', (e) => {
    colorCountValue.textContent = e.target.value;
});
colorCountInput.addEventListener('change', () => {
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
    // Store original filename without extension for export
    uploadedFileName = file.name.replace(/\.[^/.]+$/, "");

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

        // --- Color Quantization (K-Means) ---
        const k = parseInt(colorCountInput.value) || 16;
        const tinyImageData = tempCtx.getImageData(0, 0, gridW, gridH);
        const quantizedData = quantizeColors(tinyImageData, k);
        tempCtx.putImageData(quantizedData, 0, 0);

        // Save state for Export
        lastProcessedData = {
            width: gridW,
            height: gridH,
            pixels: quantizedData.data,
            k: k
        };

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
        lastProcessedData = null;
    }
}

function generateSVG() {
    if (!lastProcessedData) return;

    const { width, height, pixels } = lastProcessedData;
    const boxSize = 10; // SVG unit size for one cell
    const headerSize = 20; // Space for numbering
    const legendItemHeight = 20;

    // 1. Extract Unique Colors (Palette)
    const colorMap = new Map();
    const grid = [];
    let palette = [];

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a === 0) {
            grid.push(null); // Transparent
            continue;
        }

        const hex = rgbToHex(r, g, b);
        if (!colorMap.has(hex)) {
            colorMap.set(hex, palette.length + 1);
            palette.push({ hex, id: palette.length + 1, r, g, b });
        }
        grid.push({ hex, id: colorMap.get(hex), r, g, b });
    }

    // Get User Options
    const showLegend = document.getElementById('toggleLegend').checked;
    const showNumbers = document.getElementById('toggleNumbers').checked;
    const showColors = document.getElementById('toggleColors').checked;

    // Canvas Size
    // Grid area: width * boxSize, height * boxSize
    // Margins: left/top for headers
    // Legend: Bottom
    const marginLeft = 30;
    const marginTop = 30;
    const contentWidth = width * boxSize;
    const contentHeight = height * boxSize;

    // Calculate Legend Height (only if enabled)
    let legendHeight = 0;
    if (showLegend) {
        legendHeight = Math.ceil(palette.length / 4) * legendItemHeight + 40;
    }

    const totalWidth = contentWidth + marginLeft + 20;
    const totalHeight = contentHeight + marginTop + legendHeight;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" font-family="sans-serif">`;

    // Background
    svg += `<rect width="100%" height="100%" fill="white" />`;

    // 2. Draw Grid & Numbers
    const fontSize = boxSize * 0.4;

    // Column Headers (A, B, C...)
    for (let x = 0; x < width; x++) {
        const label = getColumnLabel(x);
        svg += `<text x="${marginLeft + x * boxSize + boxSize / 2}" y="${marginTop - 5}" text-anchor="middle" font-size="10" fill="#666">${label}</text>`;
    }

    // Row Headers (1, 2, 3...)
    for (let y = 0; y < height; y++) {
        svg += `<text x="${marginLeft - 5}" y="${marginTop + y * boxSize + boxSize * 0.7}" text-anchor="end" font-size="10" fill="#666">${y + 1}</text>`;
    }

    // Grid Cells
    for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];
        if (!cell) continue;

        const x = i % width;
        const y = Math.floor(i / width);
        const posX = marginLeft + x * boxSize;
        const posY = marginTop + y * boxSize;

        // Determine fill color
        const fill = showColors ? cell.hex : 'white';

        // Determine text color
        let textColor = 'black';
        if (showColors) {
            const brightness = (cell.r * 299 + cell.g * 587 + cell.b * 114) / 1000;
            textColor = brightness > 128 ? 'black' : 'white';
        }

        svg += `<g>`;
        svg += `<rect x="${posX}" y="${posY}" width="${boxSize}" height="${boxSize}" fill="${fill}" stroke="#ddd" stroke-width="0.5" />`;

        // Number inside (only if enabled)
        if (showNumbers) {
            svg += `<text x="${posX + boxSize / 2}" y="${posY + boxSize * 0.7}" text-anchor="middle" font-size="${fontSize}" fill="${textColor}">${cell.id}</text>`;
        }
        svg += `</g>`;
    }

    // 3. Draw Legend at Bottom (only if enabled)
    if (showLegend) {
        const legendY = marginTop + contentHeight + 20;
        svg += `<text x="${marginLeft}" y="${legendY}" font-size="14" font-weight="bold" fill="#333">Color Legend</text>`;

        palette.forEach((p, i) => {
            const lx = marginLeft + (i % 4) * 100; // 4 columns
            const ly = legendY + 20 + Math.floor(i / 4) * 25;

            svg += `<rect x="${lx}" y="${ly}" width="15" height="15" fill="${p.hex}" stroke="#ccc" />`;
            svg += `<text x="${lx + 20}" y="${ly + 12}" font-size="12" fill="#333">${p.id}: ${p.hex}</text>`;
        });
    }

    svg += `</svg>`;

    downloadSVG(svg);
}

function getColumnLabel(index) {
    let label = '';
    while (index >= 0) {
        label = String.fromCharCode(65 + (index % 26)) + label;
        index = Math.floor(index / 26) - 1;
    }
    return label;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function downloadSVG(svgContent) {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFileName}-pixelart.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Color Quantization Helper ---
function quantizeColors(imageData, k) {
    const data = imageData.data;
    const pixels = [];

    // Collect all non-transparent pixels
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            pixels.push({
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
                index: i
            });
        }
    }

    if (pixels.length === 0 || k >= pixels.length) return imageData;

    // Initialize Centroids (Randomly pick k pixels)
    let centroids = [];
    for (let i = 0; i < k; i++) {
        const p = pixels[Math.floor(Math.random() * pixels.length)];
        centroids.push({ r: p.r, g: p.g, b: p.b });
    }

    // K-Means Iterations
    const maxIterations = 5; // Low iteration count for real-time performance
    for (let iter = 0; iter < maxIterations; iter++) {
        const clusters = Array.from({ length: k }, () => []);

        // 1. Assign pixels to nearest centroid
        pixels.forEach(p => {
            let minDist = Infinity;
            let closestIndex = 0;

            centroids.forEach((c, i) => {
                const dist = Math.sqrt((p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    closestIndex = i;
                }
            });
            clusters[closestIndex].push(p);
        });

        // 2. Recalculate centroids
        let converged = true;
        centroids = centroids.map((c, i) => {
            const cluster = clusters[i];
            if (cluster.length === 0) return c; // Keep old centroid if empty

            let sumR = 0, sumG = 0, sumB = 0;
            cluster.forEach(p => {
                sumR += p.r;
                sumG += p.g;
                sumB += p.b;
            });

            const newR = Math.round(sumR / cluster.length);
            const newG = Math.round(sumG / cluster.length);
            const newB = Math.round(sumB / cluster.length);

            if (newR !== c.r || newG !== c.g || newB !== c.b) converged = false;

            return { r: newR, g: newG, b: newB };
        });

        if (converged) break;
    }

    // Apply color reduction
    pixels.forEach(p => {
        let minDist = Infinity;
        let closestIndex = 0;

        centroids.forEach((c, i) => {
            const dist = Math.sqrt((p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        });

        const finalColor = centroids[closestIndex];
        data[p.index] = finalColor.r;
        data[p.index + 1] = finalColor.g;
        data[p.index + 2] = finalColor.b;
        // Alpha remains same
    });

    return imageData;
}
