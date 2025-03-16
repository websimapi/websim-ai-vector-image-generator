document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const promptInput = document.getElementById('promptInput');
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const generateBtn = document.getElementById('generateBtn');
    const originalImageContainer = document.getElementById('originalImageContainer');
    const vectorImageContainer = document.getElementById('vectorImageContainer');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // State
    let originalImageUrl = null;
    let svgContent = null;
    
    // Event listeners
    generateBtn.addEventListener('click', generateImage);
    downloadBtn.addEventListener('click', downloadSvg);
    
    // Generate image from prompt
    async function generateImage() {
        try {
            // Clear previous results
            originalImageContainer.innerHTML = '<div class="loader"></div>';
            vectorImageContainer.innerHTML = '<div class="loader"></div>';
            downloadBtn.disabled = true;
            
            // Update status
            statusMessage.textContent = 'Generating image...';
            
            // Get user input
            const prompt = promptInput.value.trim();
            const aspectRatio = aspectRatioSelect.value;
            
            if (!prompt) {
                throw new Error('Please enter a prompt');
            }
            
            // Call AI image generation
            const result = await websim.imageGen({
                prompt: prompt,
                aspect_ratio: aspectRatio
            });
            
            // Display original image
            originalImageUrl = result.url;
            originalImageContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = originalImageUrl;
            img.alt = prompt;
            img.crossOrigin = "anonymous"; 
            originalImageContainer.appendChild(img);
            
            // Update status
            statusMessage.textContent = 'Converting to vector...';
            
            // Convert to vector
            await convertToVector(img, originalImageUrl);
            
        } catch (error) {
            statusMessage.textContent = `Error: ${error.message}`;
            originalImageContainer.innerHTML = '<div class="placeholder">Error generating image</div>';
            vectorImageContainer.innerHTML = '<div class="placeholder">Vector conversion failed</div>';
        }
    }
    
    // Convert image to vector using Potrace
    async function convertToVector(img, imageUrl) {
        try {
            // Create a new image with crossOrigin set
            const corsImage = new Image();
            corsImage.crossOrigin = "anonymous";
            
            // Wait for the image to load safely
            await new Promise((resolve, reject) => {
                corsImage.onload = resolve;
                corsImage.onerror = () => reject(new Error("Failed to load image"));
                corsImage.src = imageUrl;
            });
            
            // Create a canvas to process the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = corsImage.naturalWidth;
            canvas.height = corsImage.naturalHeight;
            
            // Draw the image on canvas
            ctx.drawImage(corsImage, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Check if Potrace is available - directly check the global Potrace object
            if (typeof Potrace === 'undefined') {
                throw new Error("Potrace library not loaded. Please refresh the page and try again.");
            }
            
            // Use the simpler Potrace API from the new library
            const potrace = Potrace.loadImageFromData(imageData);
            
            // Set potrace options
            potrace.setParameter({
                turdsize: 5,
                turnpolicy: Potrace.TURNPOLICY_MINORITY,
                optcurve: true,
                alphamax: 1,
                opttolerance: 0.2,
                threshold: 128
            });
            
            // Generate SVG
            svgContent = potrace.getSVG(1.0);
            
            // Display vector image
            vectorImageContainer.innerHTML = svgContent;
            const svgElement = vectorImageContainer.querySelector('svg');
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
            
            // Enable download button
            downloadBtn.disabled = false;
            statusMessage.textContent = 'Vector conversion complete! Click to download.';
        } catch (error) {
            // Fall back to a simple SVG tracing if Potrace fails
            try {
                if (error.message.includes("Potrace library not loaded")) {
                    statusMessage.textContent = 'Using fallback vector conversion...';
                    await fallbackVectorConversion(corsImage);
                } else {
                    throw error;
                }
            } catch (fallbackError) {
                statusMessage.textContent = `Vector conversion error: ${error.message}`;
                vectorImageContainer.innerHTML = '<div class="placeholder">Vector conversion failed</div>';
                console.error(error);
            }
        }
    }
    
    // Fallback vector conversion for when Potrace fails
    async function fallbackVectorConversion(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Draw the image on canvas
        ctx.drawImage(img, 0, 0);
        
        // Get image data and create a simple SVG path
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Create a simplified SVG by sampling pixels
        let paths = [];
        const sampleRate = 8; // Sample every 8 pixels
        
        for (let y = 0; y < height; y += sampleRate) {
            for (let x = 0; x < width; x += sampleRate) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = (r + g + b) / 3;
                
                if (brightness < 128) { // Dark pixels only
                    const size = Math.max(1, sampleRate / 2);
                    paths.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="black" />`);
                }
            }
        }
        
        // Create the SVG
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
            ${paths.join('\n')}
        </svg>`;
        
        // Display vector image
        vectorImageContainer.innerHTML = svgContent;
        const svgElement = vectorImageContainer.querySelector('svg');
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        
        // Enable download button
        downloadBtn.disabled = false;
        statusMessage.textContent = 'Simple vector conversion complete! Click to download.';
    }
    
    // Download SVG file
    function downloadSvg() {
        if (!svgContent) {
            statusMessage.textContent = 'No vector image to download';
            return;
        }
        
        // Create a blob from SVG content
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link to download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = `vector-image-${Date.now()}.svg`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        statusMessage.textContent = 'SVG downloaded successfully!';
    }
});