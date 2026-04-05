/**
 * FileUploadService
 * 
 * Handles file upload and conversion to Gemini-compatible inline data.
 * Uses a single API (Google Gemini's inline_data) for all supported file types:
 *   - Images: jpeg, png, webp, gif, bmp, heif
 *   - Documents: pdf, txt, html, css, js, ts, md, csv, xml
 *   - Audio: mp3, wav, ogg, flac, aac
 *   - Video: mp4, webm, mov, avi
 * 
 * Files are read as base64 and sent as parts in generateContent.
 */

// ─── Types ────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
  category: FileCategory;
  previewUrl?: string; // For images — object URL
  thumbnailEmoji: string;
}

export type FileCategory = 'image' | 'document' | 'audio' | 'video' | 'code' | 'unknown';

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

// ─── Constants ────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES: Record<string, FileCategory> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/bmp': 'image',
  'image/heif': 'image',
  'image/heic': 'image',
  // Documents
  'application/pdf': 'document',
  'text/plain': 'document',
  'text/html': 'document',
  'text/css': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/markdown': 'document',
  'text/csv': 'document',
  'text/xml': 'document',
  'application/json': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-typescript': 'code',
  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/webm': 'audio',
  // Video
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/mpeg': 'video',
};

const CATEGORY_EMOJI: Record<FileCategory, string> = {
  image: '🖼️',
  document: '📄',
  audio: '🎵',
  video: '🎬',
  code: '💻',
  unknown: '📎',
};

// Extension → MIME type fallback (for when browser doesn't detect)
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.ts': 'text/x-typescript',
  '.tsx': 'text/x-typescript',
  '.jsx': 'application/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.pdf': 'application/pdf',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit for inline data

// ─── Service ──────────────────────────────────────────────────

export class FileUploadService {
  /**
   * Process a File from an <input type="file"> element.
   * Reads it as base64, validates the type, and returns an UploadedFile.
   */
  public async processFile(file: File): Promise<UploadedFile> {
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 20MB.`);
    }

    // Resolve MIME type
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      mimeType = EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    }

    // Validate support
    const category = SUPPORTED_MIME_TYPES[mimeType] || 'unknown';
    if (category === 'unknown' && !mimeType.startsWith('text/')) {
      throw new Error(`Unsupported file type: ${mimeType}. Supported: images, documents, audio, video, and code files.`);
    }

    // Read as base64
    const base64Data = await this.readAsBase64(file);

    // Generate preview URL for images
    let previewUrl: string | undefined;
    if (category === 'image') {
      previewUrl = URL.createObjectURL(file);
    }

    return {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: file.name,
      mimeType,
      size: file.size,
      base64Data,
      category,
      previewUrl,
      thumbnailEmoji: CATEGORY_EMOJI[category],
    };
  }

  /**
   * Convert an UploadedFile to a Gemini-compatible inline_data part.
   */
  public toInlineDataPart(file: UploadedFile): InlineDataPart {
    return {
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64Data,
      },
    };
  }

  /**
   * Build the text description of attached files for the system context.
   */
  public buildFileContextDescription(files: UploadedFile[]): string {
    if (files.length === 0) return '';
    
    const descriptions = files.map(f => {
      const sizeKb = (f.size / 1024).toFixed(1);
      return `${f.thumbnailEmoji} ${f.name} (${f.mimeType}, ${sizeKb}KB)`;
    });

    return `\n[Attached files: ${descriptions.join(', ')}]\nPlease analyze the attached file(s) in the context of the current lesson. If it's student work, evaluate it. If it's reference material, use it to enhance your teaching.`;
  }

  /**
   * Format file size for display.
   */
  public formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Clean up object URLs to prevent memory leaks.
   */
  public revokePreview(file: UploadedFile): void {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }

  // ── Private ──────────────────────────────────────────────────

  private readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix: "data:image/png;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }
}

// Singleton
export const fileUploadService = new FileUploadService();
