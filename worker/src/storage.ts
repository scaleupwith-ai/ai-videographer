import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

// R2 client
const s3Client = new S3Client({
  region: "auto",
  endpoint: config.r2Endpoint,
  credentials: {
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  },
});

/**
 * Download a file from R2 to local path
 */
export async function downloadFile(objectKey: string, localPath: string): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Get signed URL
  const command = new GetObjectCommand({
    Bucket: config.r2Bucket,
    Key: objectKey,
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Download file
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    const protocol = signedUrl.startsWith("https") ? https : http;

    protocol
      .get(signedUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(localPath, () => {}); // Clean up partial file
        reject(err);
      });
  });
}

/**
 * Download a file from a public URL to local path
 */
export async function downloadFromUrl(url: string, localPath: string): Promise<void> {
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if this is a Google Drive URL
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    return downloadFromGoogleDrive(url, localPath);
  }

  console.log(`Downloading from URL: ${url.substring(0, 80)}...`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    const urlObj = new URL(url);
    const protocol = url.startsWith("https") ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    };

    protocol
      .get(options, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
          if (response.headers.location) {
            file.close();
            let redirectUrl = response.headers.location;
            // Handle relative URLs
            if (redirectUrl.startsWith('/')) {
              redirectUrl = `${urlObj.protocol}//${urlObj.hostname}${redirectUrl}`;
            }
            downloadFromUrl(redirectUrl, localPath)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(localPath, () => {});
          reject(new Error(`Failed to download (HTTP ${response.statusCode}): ${url}`));
          return;
        }

        // Check content length for debugging
        const contentLength = response.headers['content-length'];
        const contentType = response.headers['content-type'];
        console.log(`  Content-Type: ${contentType}, Length: ${contentLength || 'unknown'}`);

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          // Verify file was actually written
          const stats = fs.statSync(localPath);
          if (stats.size === 0) {
            fs.unlink(localPath, () => {});
            reject(new Error(`Downloaded file is empty: ${url.substring(0, 50)}`));
          } else {
            console.log(`  Downloaded ${stats.size} bytes to ${path.basename(localPath)}`);
            resolve();
          }
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(localPath, () => {});
        reject(new Error(`Download error for ${url.substring(0, 50)}: ${err.message}`));
      });
  });
}

/**
 * Download a file from Google Drive
 * Handles the confirmation page for large files with proper cookie handling
 */
async function downloadFromGoogleDrive(url: string, localPath: string): Promise<void> {
  // Extract file ID from URL
  let fileId: string | null = null;
  
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    fileId = idMatch[1];
  } else {
    const pathMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) {
      fileId = pathMatch[1];
    }
  }

  if (!fileId) {
    throw new Error(`Could not extract file ID from Google Drive URL: ${url}`);
  }

  console.log(`Downloading Google Drive file: ${fileId}`);

  // Try multiple download methods
  const downloadMethods = [
    // Method 1: Direct download with confirm=t
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    // Method 2: Direct download without confirm (small files)
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    // Method 3: Export via docs.google.com
    `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`,
  ];

  let lastError: Error | null = null;

  for (const downloadUrl of downloadMethods) {
    try {
      await attemptGoogleDriveDownload(downloadUrl, fileId, localPath);
      console.log(`Successfully downloaded: ${fileId}`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`Method failed: ${downloadUrl.substring(0, 50)}... - ${lastError.message}`);
    }
  }

  throw lastError || new Error("All Google Drive download methods failed");
}

/**
 * Attempt to download from a specific Google Drive URL
 */
function attemptGoogleDriveDownload(
  downloadUrl: string, 
  fileId: string, 
  localPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    let cookies: string[] = [];
    
    const makeRequest = (requestUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        file.close();
        reject(new Error("Too many redirects"));
        return;
      }

      const urlObj = new URL(requestUrl);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': cookies.join('; '),
        },
      };

      https.get(options, (response) => {
        // Collect cookies
        const setCookies = response.headers['set-cookie'];
        if (setCookies) {
          for (const cookie of setCookies) {
            const cookieName = cookie.split('=')[0];
            const cookieValue = cookie.split(';')[0];
            // Remove old cookie with same name
            cookies = cookies.filter(c => !c.startsWith(cookieName + '='));
            cookies.push(cookieValue);
          }
        }

        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
          if (response.headers.location) {
            let redirectUrl = response.headers.location;
            // Handle relative URLs
            if (redirectUrl.startsWith('/')) {
              redirectUrl = `https://${urlObj.hostname}${redirectUrl}`;
            }
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        // Check content type
        const contentType = response.headers["content-type"] || "";
        
        // If it's HTML, we hit the confirmation page
        if (contentType.includes("text/html")) {
          let data = "";
          response.on("data", (chunk) => { data += chunk; });
          response.on("end", () => {
            // Look for download link in the HTML
            // Pattern 1: Look for the form action with confirm parameter
            const confirmMatch = data.match(/confirm=([0-9A-Za-z_-]+)/);
            // Pattern 2: Look for uuid in download_warning cookie
            const uuidMatch = data.match(/download_warning[^=]*=([0-9A-Za-z_-]+)/);
            // Pattern 3: Look for data-confirm in the page
            const dataConfirm = data.match(/data-confirm="([^"]+)"/);
            
            const confirmToken = confirmMatch?.[1] || uuidMatch?.[1] || dataConfirm?.[1] || 't';
            
            // Try with the confirm token
            const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`;
            
            if (redirectCount < 3) {
              makeRequest(confirmUrl, redirectCount + 1);
            } else {
              file.close();
              reject(new Error("Could not bypass confirmation page"));
            }
          });
          return;
        }

        // It's a real file, download it
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          
          // Verify file is not empty or HTML
          const stats = fs.statSync(localPath);
          if (stats.size < 1000) {
            const content = fs.readFileSync(localPath, 'utf8');
            if (content.includes('<!DOCTYPE') || content.includes('<html')) {
              reject(new Error("Downloaded HTML instead of video file"));
              return;
            }
          }
          
          resolve();
        });
        file.on("error", (err) => {
          reject(err);
        });
      }).on("error", (err) => {
        file.close();
        fs.unlink(localPath, () => {});
        reject(err);
      });
    };

    makeRequest(downloadUrl);
  });
}

/**
 * Upload a file to R2
 */
export async function uploadFile(
  localPath: string,
  objectKey: string,
  contentType: string
): Promise<string> {
  const fileContent = fs.readFileSync(localPath);

  const command = new PutObjectCommand({
    Bucket: config.r2Bucket,
    Key: objectKey,
    Body: fileContent,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return public URL
  return `${config.r2PublicBaseUrl}/${objectKey}`;
}

/**
 * Get file size in bytes
 */
export function getFileSize(localPath: string): number {
  const stats = fs.statSync(localPath);
  return stats.size;
}

/**
 * Clean up local files
 */
export function cleanupFiles(paths: string[]): void {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to clean up ${filePath}:`, err);
    }
  }
}

/**
 * Clean up directory
 */
export function cleanupDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to clean up directory ${dirPath}:`, err);
  }
}

