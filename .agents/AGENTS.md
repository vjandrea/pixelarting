# Project Plan: Serverless PixelArt Grid Generator

## Kick-off prompt

I want to build a Pixel Art Generator. Start by creating an `index.html` and `script.js`. The app should allow a user to upload an image, remove the background based on a threshold slider, and display the cropped subject on a canvas. Use the top-left pixel color as the background reference.

## 🎯 Project Vision
A web-based tool hosted on GitHub Pages that converts any image into a printable "color-by-number" pixel art guide. The app performs background removal, subject cropping, color quantization, and generates a print-ready SVG with a coordinate grid and color legend.

---

## 🛠 Tech Stack
- **Frontend:** HTML5, CSS3 (Tailwind/Standard), JavaScript (ES6+).
- **Processing:** HTML5 Canvas API (Client-side raster manipulation).
- **Output:** SVG (Scalable Vector Graphics) for high-fidelity printing.
- **Hosting:** GitHub Pages (Zero-latency, zero-cost).

---

## 🏗 Core Algorithm Flow

### 1. Background Removal & Auto-Crop

Sample the pixel at `(0,0)` to identify the background color and calculate a bounding box for the subject.

```javascript
// Euclidean distance for background masking
const dist = Math.sqrt((r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2);
if (dist < threshold) {
    data[i + 3] = 0; // Set Alpha to transparent
} else {
    // Update Bounding Box coordinates
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
}
```

### 2. Color Quantization (K-Means)

Reduce the image palette to a specific number of colors (e.g., 16) to make it reproducible with pens/pencils.

```javascript
// Map every pixel to the nearest centroid (color cluster)
centroids.forEach((color, index) => {
    const d = Math.sqrt((p.r-color.r)**2 + (p.g-color.g)**2 + (p.b-color.b)**2);
    if (d < minDist) { minDist = d; closestIndex = index; }
});
```


### 3. SVG Grid Generation

Convert the processed grid into a structured SVG document.

```javascript
// SVG Rect with dynamic text contrast (Luminance check)
const isDark = (0.2126*r + 0.7152*g + 0.0722*b) < 128;
svgMarkup += `
  <g>
    <rect x="${x}" y="${y}" width="1" height="1" fill="${hex}" />
    <text x="${x+0.5}" y="${y+0.7}" font-size="0.4" text-anchor="middle" fill="${isDark?'white':'black'}">
      ${colorId}
    </text>
  </g>`;
```

## Implementation Roadmap (To-Do List)

### Phase 1: UI & File Handling
- [x] Build a layout with a control Sidebar and a central Preview Area.
- [x] Implement image upload to an off-screen Canvas.
- [x] Add sliders for: Background Threshold, Grid Size (e.g., 16 to 128), and Color Count (e.g., 2 to 32).

### Phase 2: Image Processing Engine

- [x] Implement removeBackground() function with real-time threshold preview.
- [x] Implement autoCrop() to trim empty space based on alpha values.
- [x] Implement quantizeColors() using a K-Means algorithm to find dominant colors.

### Phase 3: Export & Print Logic

- [x] Generate an SVG with shape-rendering="crispEdges" for perfect sharpness.
- [x] Add a coordinate system: Numbered headers for rows and columns.
- [x] Render a Color Legend at the bottom of the SVG showing Color ID vs. Swatch.
- [x] Add a "Download SVG" button that triggers a blob download.

### Phase 4: Polish & Deployment
- [ ] Ensure the SVG layout fits standard A4 printer proportions.
- [x] Add a "Wireframe Mode" (show numbers only, no color fills) for coloring-book style.
- [x] Deploy to GitHub Pages via repository settings.