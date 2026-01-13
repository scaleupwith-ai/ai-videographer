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
  if (url.includes("drive.google.com")) {
    return downloadFromGoogleDrive(url, localPath);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          if (response.headers.location) {
            file.close();
            downloadFromUrl(response.headers.location, localPath)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
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
        fs.unlink(localPath, () => {});
        reject(err);
      });
  });
}

/**
 * Download a file from Google Drive
 * Handles the confirmation page for large files
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

  // Use the export download URL with confirm parameter
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    };

    const makeRequest = (requestUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(requestUrl, options, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
          if (response.headers.location) {
            makeRequest(response.headers.location, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download from Google Drive: ${response.statusCode}`));
          return;
        }

        // Check if response is HTML (confirmation page) vs actual file
        const contentType = response.headers["content-type"] || "";
        if (contentType.includes("text/html")) {
          // This might be a virus scan warning page, try with confirm=t
          let data = "";
          response.on("data", (chunk) => { data += chunk; });
          response.on("end", () => {
            // Look for confirm token in the HTML
            const confirmMatch = data.match(/confirm=([0-9A-Za-z_-]+)/);
            if (confirmMatch) {
              const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
              makeRequest(confirmUrl, redirectCount + 1);
            } else {
              reject(new Error("Could not bypass Google Drive download confirmation"));
            }
          });
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }).on("error", (err) => {
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

