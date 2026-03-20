/**
 * Compresses and downscales an image file to a maximum dimension
 * to save bandwidth and Gemini token usage.
 * 
 * @param {File} file - The original image file
 * @param {number} maxDimension - Maximum width or height
 * @returns {Promise<File>} The compressed file
 */
export async function optimizeImage(file, maxDimension = 1500) {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height *= maxDimension / width));
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width *= maxDimension / height));
            height = maxDimension;
          }
        }

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP for max efficiency
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file); // fallback to original if compression fails
            return;
          }
          const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
            lastModified: Date.now()
          });
          resolve(optimizedFile);
        }, 'image/webp', 0.85); // 85% quality WebP
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
