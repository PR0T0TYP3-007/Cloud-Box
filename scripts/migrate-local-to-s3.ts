/**
 * Migration Script: Local Filesystem to AWS S3
 * 
 * This script migrates existing files from local uploads/ directory to S3
 * and updates the database records with new S3 keys.
 * 
 * Usage:
 *   ts-node scripts/migrate-local-to-s3.ts
 * 
 * Prerequisites:
 *   - AWS credentials configured in .env
 *   - Database connection configured
 *   - All environment variables set
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database entities (adjust import paths as needed)
interface FileEntity {
  id: string;
  storagePath: string;
  user: { id: string };
  name: string;
}

interface FileVersionEntity {
  id: string;
  storageKey: string;
  file: { id: string };
}

class S3Migrator {
  private s3Client: S3Client;
  private bucket: string;
  private dataSource: DataSource;
  private uploadedCount = 0;
  private failedCount = 0;
  private skippedCount = 0;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.AWS_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.AWS_S3_ENDPOINT;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing AWS credentials. Please configure .env file.');
    }

    this.bucket = bucket;

    const clientConfig: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.s3Client = new S3Client(clientConfig);

    // Initialize database connection
    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: ['src/database/*.entity.ts'],
      synchronize: false,
    });
  }

  async initialize() {
    await this.dataSource.initialize();
    console.log('Database connection established');
  }

  async migrate() {
    try {
      await this.initialize();

      const fileRepository = this.dataSource.getRepository('File');
      const versionRepository = this.dataSource.getRepository('FileVersion');

      // Get all files that have local storage paths
      const files = await fileRepository
        .createQueryBuilder('file')
        .leftJoinAndSelect('file.user', 'user')
        .where("file.storagePath IS NOT NULL")
        .andWhere("file.storagePath NOT LIKE 'users/%'") // Skip already migrated files
        .getMany();

      console.log(`Found ${files.length} files to migrate\n`);

      for (const file of files as FileEntity[]) {
        try {
          await this.migrateFile(file, fileRepository, versionRepository);
        } catch (error) {
          console.error(`Failed to migrate file ${file.id}:`, error.message);
          this.failedCount++;
        }
      }

      console.log('\n=== Migration Summary ===');
      console.log(`Total files: ${files.length}`);
      console.log(`Uploaded: ${this.uploadedCount}`);
      console.log(`Skipped: ${this.skippedCount}`);
      console.log(`Failed: ${this.failedCount}`);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await this.dataSource.destroy();
    }
  }

  private async migrateFile(
    file: FileEntity,
    fileRepository: any,
    versionRepository: any,
  ) {
    const localPath = file.storagePath;

    // Check if file exists locally
    if (!fs.existsSync(localPath)) {
      console.log(`⚠ Skipping ${file.id}: Local file not found at ${localPath}`);
      this.skippedCount++;
      return;
    }

    // Generate S3 key
    const ext = path.extname(file.name);
    const s3Key = `users/${file.user.id}/files/${file.id}${ext}`;

    // Read file
    const fileBuffer = fs.readFileSync(localPath);
    const fileSize = fileBuffer.length;

    // Upload to S3
    console.log(`📤 Uploading ${file.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: fileBuffer,
    });

    await this.s3Client.send(command);

    // Update database record
    await fileRepository.update({ id: file.id }, { storagePath: s3Key });

    // Update file versions
    const versions = await versionRepository.find({
      where: { file: { id: file.id } },
    });

    for (const version of versions) {
      await versionRepository.update(
        { id: version.id },
        { storageKey: s3Key },
      );
    }

    console.log(`✅ Migrated ${file.name} -> ${s3Key}`);
    this.uploadedCount++;
  }

  async migrateThumbnails() {
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');

    if (!fs.existsSync(thumbnailDir)) {
      console.log('No thumbnails directory found, skipping...');
      return;
    }

    const thumbnailFiles = fs.readdirSync(thumbnailDir);
    console.log(`\n=== Migrating ${thumbnailFiles.length} Thumbnails ===\n`);

    for (const thumbnailFile of thumbnailFiles) {
      try {
        const localPath = path.join(thumbnailDir, thumbnailFile);
        const s3Key = `thumbnails/${thumbnailFile}`;

        const fileBuffer = fs.readFileSync(localPath);

        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'image/webp',
        });

        await this.s3Client.send(command);
        console.log(`✅ Migrated thumbnail ${thumbnailFile}`);
      } catch (error) {
        console.error(`Failed to migrate thumbnail ${thumbnailFile}:`, error.message);
      }
    }
  }
}

// Run migration
async function main() {
  console.log('=== AWS S3 Migration Tool ===\n');
  console.log('This will migrate all files from local storage to S3');
  console.log('Make sure you have:');
  console.log('  1. Configured AWS credentials in .env');
  console.log('  2. Created the S3 bucket');
  console.log('  3. Backed up your database\n');

  const migrator = new S3Migrator();

  try {
    // Migrate files
    await migrator.migrate();

    // Migrate thumbnails
    await migrator.migrateThumbnails();

    console.log('\n✨ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Verify files in S3 bucket');
    console.log('  2. Test file download/upload operations');
    console.log('  3. After verification, you can delete local uploads/ directory');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nMigration interrupted by user');
  process.exit(0);
});

main();
