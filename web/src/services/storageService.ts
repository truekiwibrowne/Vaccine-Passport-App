/**
 * Zero-cost image storage — compresses images client-side and returns a
 * base64 data URL that can be stored directly in Firestore.
 *
 * No Firebase Storage plan required during development/testing.
 * When ready for production, swap uploadFile() to use Firebase Storage
 * and the rest of the app needs no changes.
 *
 * Limits:
 *  - Profile photos: 300×300px, JPEG 0.75  ≈ 15–40 KB
 *  - Evidence photos: 900×900px, JPEG 0.80  ≈ 80–200 KB
 * Firestore document max is 1 MB, so a single field is fine.
 */

type ImagePurpose = 'profile' | 'evidence'

const SIZES: Record<ImagePurpose, { maxDim: number; quality: number }> = {
  profile:  { maxDim: 300,  quality: 0.75 },
  evidence: { maxDim: 900,  quality: 0.80 },
}

/**
 * Compress a File to a base64 JPEG data URL sized for its purpose.
 * Drop-in replacement for the Firebase Storage uploadFile() — same
 * signature, same return type (a URL string).
 */
export async function uploadFile(
  _uid: string,
  file: File,
  folder: ImagePurpose | string = 'evidence'
): Promise<string> {
  const purpose: ImagePurpose = folder === 'profile' ? 'profile' : 'evidence'
  return compressToDataUrl(file, SIZES[purpose].maxDim, SIZES[purpose].quality)
}

function compressToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        // Calculate scaled dimensions keeping aspect ratio
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height / width) * maxDim)
            width = maxDim
          } else {
            width = Math.round((width / height) * maxDim)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not available')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** No-op — base64 strings are deleted when the Firestore doc is updated */
export async function deleteFile(_url: string): Promise<void> {
  // Nothing to do for base64 storage
}
