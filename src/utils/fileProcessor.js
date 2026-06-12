/**
 * File Processing Utilities
 *
 * Validation, conversion, and metadata helpers for uploaded clinical documents.
 */

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const SUPPORTED_DOC_TYPES = ['application/pdf'];

const ALL_SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOC_TYPES];

/** Maximum allowed file size in bytes (20 MB). */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Validate that a file's type and size are acceptable.
 *
 * @param {File} file
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALL_SUPPORTED_TYPES.includes(file.type)) {
    const allowed = ALL_SUPPORTED_TYPES.map((t) => t.split('/')[1]).join(', ');
    return {
      valid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Accepted types: ${allowed}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`,
    };
  }

  return { valid: true };
}

/**
 * Categorise a file as 'image', 'pdf', or 'unsupported'.
 *
 * @param {File} file
 * @returns {'image' | 'pdf' | 'unsupported'}
 */
export function getFileCategory(file) {
  if (SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (SUPPORTED_DOC_TYPES.includes(file.type)) return 'pdf';
  return 'unsupported';
}

/**
 * Detect the actual MIME type of a file by reading its magic bytes,
 * rather than trusting the file extension or browser-reported type.
 *
 * @param {ArrayBuffer} buffer - First few bytes of the file
 * @returns {string|null} Detected MIME type or null
 */
function detectMimeFromBytes(buffer) {
  const bytes = new Uint8Array(buffer).slice(0, 12);
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  return null;
}

/**
 * Detect the real MIME type of a file by reading its binary header.
 * Falls back to the browser-reported file.type if detection fails.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function detectRealMimeType(file) {
  const headerSlice = file.slice(0, 12);
  const buffer = await headerSlice.arrayBuffer();
  return detectMimeFromBytes(buffer) || file.type;
}

/**
 * Read a File object and return its contents as a raw base64 string
 * (without the `data:...;base64,` prefix).
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>"
      const dataUrl = /** @type {string} */ (reader.result);
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('Failed to extract base64 data from file'));
      }
    };

    reader.onerror = () => {
      reject(new Error(reader.error?.message ?? 'FileReader error'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Return an icon name (e.g. for a UI icon library) based on the file's
 * extension.
 *
 * @param {string} fileName
 * @returns {string} icon identifier
 */
export function getFileIcon(fileName) {
  if (!fileName) return 'file';

  const ext = fileName.split('.').pop()?.toLowerCase();

  const iconMap = {
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    pdf: 'file-text',
    doc: 'file-text',
    docx: 'file-text',
    csv: 'table',
    xls: 'table',
    xlsx: 'table',
    txt: 'file-text',
  };

  return iconMap[ext] ?? 'file';
}

/**
 * Format a byte count into a human-readable string (e.g. "2.3 MB").
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
