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
            
            // Check if Potrace is available - using the global Potrace object provided by potracelib.min.js
            if (typeof Potrace === 'undefined') {
                throw new Error("Potrace library not loaded. Please refresh the page and try again.");
            }
            
            // Create a new instance with the Potrace module
            const potrace = new Potrace();
            
            // Configure Potrace
            potrace.setParameter({
                turdSize: 5,
                turnPolicy: Potrace.TURNPOLICY_MINORITY,
                alphaMax: 1,
                optCurve: true,
                optTolerance: 0.2,
                threshold: 128
            });
            
            // Process image and generate SVG
            potrace.loadImageData(imageData);
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
            statusMessage.textContent = `Vector conversion error: ${error.message}`;
            vectorImageContainer.innerHTML = '<div class="placeholder">Vector conversion failed</div>';
        }
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