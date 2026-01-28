/**
 * Parse Google Drive share link and return direct download/stream URL
 * 
 * Supported formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 */
export function parseGDriveLink(shareLink: string): {
  fileId: string | null;
  directUrl: string | null;
  embedUrl: string | null;
} {
  if (!shareLink) {
    return { fileId: null, directUrl: null, embedUrl: null };
  }

  let fileId: string | null = null;

  // Pattern 1: /file/d/FILE_ID/
  const pattern1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match1 = shareLink.match(pattern1);
  if (match1) {
    fileId = match1[1];
  }

  // Pattern 2: ?id=FILE_ID or &id=FILE_ID
  if (!fileId) {
    const pattern2 = /[?&]id=([a-zA-Z0-9_-]+)/;
    const match2 = shareLink.match(pattern2);
    if (match2) {
      fileId = match2[1];
    }
  }

  // Pattern 3: /folders/FILE_ID (for folder links, less common for videos)
  if (!fileId) {
    const pattern3 = /\/folders\/([a-zA-Z0-9_-]+)/;
    const match3 = shareLink.match(pattern3);
    if (match3) {
      fileId = match3[1];
    }
  }

  if (!fileId) {
    return { fileId: null, directUrl: null, embedUrl: null };
  }

  // Direct download URL (works for publicly shared files)
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  
  // Embed URL (for preview/streaming)
  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return { fileId, directUrl, embedUrl };
}

/**
 * Get streamable URL for video playback
 * This uses the Google Drive embed player which works better for streaming
 */
export function getStreamUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Get direct download URL for FFmpeg processing
 */
export function getDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}







