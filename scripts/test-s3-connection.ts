/**
 * Simple S3 Connection Test
 * 
 * This script tests the AWS S3 connection and basic operations
 * 
 * Usage:
 *   ts-node scripts/test-s3-connection.ts
 */

import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

async function testS3Connection() {
  console.log('=== AWS S3 Connection Test ===\n');

  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;

  // Validate configuration
  console.log('Configuration:');
  console.log(`  Region: ${region}`);
  console.log(`  Bucket: ${bucket || 'NOT SET'}`);
  console.log(`  Access Key: ${accessKeyId ? accessKeyId.substring(0, 4) + '***' : 'NOT SET'}`);
  console.log(`  Endpoint: ${endpoint || 'Default AWS S3'}\n`);

  if (!bucket || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing AWS credentials. Please configure .env file.');
    process.exit(1);
  }

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

  const s3Client = new S3Client(clientConfig);

  try {
    // Test 1: List buckets (if using AWS)
    if (!endpoint) {
      console.log('Test 1: Listing buckets...');
      const listCommand = new ListBucketsCommand({});
      const listResponse = await s3Client.send(listCommand);
      console.log(`✅ Found ${listResponse.Buckets?.length || 0} buckets`);
      
      const bucketExists = listResponse.Buckets?.some(b => b.Name === bucket);
      if (bucketExists) {
        console.log(`✅ Target bucket '${bucket}' found\n`);
      } else {
        console.log(`⚠ Target bucket '${bucket}' not found in list\n`);
      }
    }

    // Test 2: Upload a test file
    console.log('Test 2: Uploading test file...');
    const testKey = 'test/connection-test.txt';
    const testContent = `S3 Connection Test - ${new Date().toISOString()}`;
    
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await s3Client.send(putCommand);
    console.log(`✅ Test file uploaded successfully to: ${testKey}\n`);

    // Test 3: Download the test file
    console.log('Test 3: Downloading test file...');
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });

    const getResponse = await s3Client.send(getCommand);
    const downloadedContent = await streamToString(getResponse.Body as any);
    
    if (downloadedContent === testContent) {
      console.log('✅ Test file downloaded successfully and content matches\n');
    } else {
      console.log('⚠ Downloaded content does not match original\n');
    }

    // Test 4: Delete the test file
    console.log('Test 4: Deleting test file...');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });

    await s3Client.send(deleteCommand);
    console.log('✅ Test file deleted successfully\n');

    console.log('=== All tests passed! ===');
    console.log('Your S3 configuration is working correctly.');
    console.log('\nYou can now:');
    console.log('  1. Start the application: npm run start:dev');
    console.log('  2. Test file upload/download operations');
    console.log('  3. Run migration script if you have existing local files\n');

  } catch (error: any) {
    console.error('\n❌ S3 Test Failed:', error.message);
    
    if (error.Code === 'NoSuchBucket') {
      console.error('\nThe specified bucket does not exist.');
      console.error('Please create the bucket first or check the bucket name.');
    } else if (error.Code === 'InvalidAccessKeyId') {
      console.error('\nThe AWS Access Key ID is invalid.');
      console.error('Please check your credentials in .env file.');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.error('\nThe AWS Secret Access Key is invalid.');
      console.error('Please check your credentials in .env file.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\nCould not connect to S3 endpoint.');
      console.error('Please check your network connection and endpoint URL.');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

testS3Connection();
