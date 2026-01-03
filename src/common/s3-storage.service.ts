import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // Optional for S3-compatible services
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.initializeS3Client();
  }

  private initializeS3Client() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.AWS_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.AWS_S3_ENDPOINT; // Optional for custom endpoints

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing required S3 configuration. Please set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.');
    }

    this.bucket = bucket;

    const clientConfig: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // Support for S3-compatible services (like MinIO, LocalStack)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true; // Required for some S3-compatible services
    }

    this.s3Client = new S3Client(clientConfig);
    this.logger.log(`S3 Storage Service initialized with bucket: ${bucket} in region: ${region}`);
  }

  /**
   * Upload a file buffer to S3
   * @param key - The S3 key (path) for the file
   * @param buffer - File buffer to upload
   * @param contentType - Optional content type
   * @returns Promise with the S3 key
   */
  async uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        },
      });

      await upload.done();
      this.logger.debug(`File uploaded successfully to S3: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Download a file from S3 as a readable stream
   * @param key - The S3 key (path) for the file
   * @returns Promise with readable stream and metadata
   */
  async downloadFile(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      this.logger.error(`Failed to download file from S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to download file from S3: ${error.message}`);
    }
  }

  /**
   * Get file as buffer (useful for small files like thumbnails)
   * @param key - The S3 key (path) for the file
   * @returns Promise with buffer
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      const { stream } = await this.downloadFile(key);
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to get file buffer from S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to get file buffer from S3: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3
   * @param key - The S3 key (path) for the file
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.debug(`File deleted successfully from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - The S3 key (path) for the file
   * @returns Promise with boolean
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.error(`Failed to check if file exists in S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to check file existence in S3: ${error.message}`);
    }
  }

  /**
   * Get file metadata from S3
   * @param key - The S3 key (path) for the file
   * @returns Promise with metadata
   */
  async getFileMetadata(key: string): Promise<{ size: number; contentType?: string; lastModified?: Date }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata from S3: ${key}`, error.stack);
      throw new InternalServerErrorException(`Failed to get file metadata from S3: ${error.message}`);
    }
  }

  /**
   * Generate S3 key from user ID and file ID
   * @param userId - User ID
   * @param fileId - File ID
   * @param extension - File extension (with dot)
   * @returns S3 key string
   */
  generateS3Key(userId: string, fileId: string, extension: string = ''): string {
    return `users/${userId}/files/${fileId}${extension}`;
  }

  /**
   * Generate S3 key for thumbnails
   * @param fileId - File ID
   * @returns S3 key string
   */
  generateThumbnailKey(fileId: string): string {
    return `thumbnails/${fileId}.webp`;
  }
}
