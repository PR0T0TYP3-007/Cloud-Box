# Cloud-Box Backend

NestJS-based backend API for the CloudBox cloud storage platform.

## Overview

Cloud-Box provides a RESTful API for file and folder management with user authentication, storage quota enforcement, sharing capabilities, and file versioning.

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with HttpOnly cookies
- **Storage**: AWS S3 (cloud object storage)
- **Testing**: Jest (unit & e2e tests)

## Features

### Storage Management
- **5GB Quota per User** - Enforced on all uploads and restore operations
- **Folder Size Calculation** - Recursive computation excluding soft-deleted items
- **Storage Usage Tracking** - Real-time calculation of used space

### File Operations
- **Upload/Download** - Multi-part file uploads with quota validation
- **File Versioning** - Track and manage file versions
- **Soft Deletion** - Files marked as deleted, can be restored from trash
- **Search** - Full-text search across files and folders

### Folder Management
- **Hierarchical Structure** - Parent-child folder relationships
- **CRUD Operations** - Create, read, update, delete folders
- **Recursive Operations** - Folder size calculation, deletion cascading

### Sharing & Permissions
- **User Shares** - Share files/folders with other users
- **Permission Levels**: View (read-only) and Edit (full access)
- **Inherited Permissions** - Subfolders/files inherit parent folder shares
- **Permission Validation** - All operations check user permissions

### Synchronization
- **Sync State Tracking** - Track file sync status across clients
- **Conflict Resolution** - Handle concurrent modifications

## Project Setup

### Prerequisites
- Node.js v18+
- PostgreSQL database
- npm or pnpm

### Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/cloudbox_dev
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=cloudbox_dev

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here

# AWS S3 Configuration (Required)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key

# Optional: For S3-compatible services (MinIO, LocalStack)
# AWS_S3_ENDPOINT=http://localhost:9000

# Server Configuration
NODE_ENV=development
PORT=3000
```

See `.env.example` for a template.

## Installation

```bash
# Install dependencies
npm install

# Set up AWS S3 bucket and configure environment variables
# See S3_MIGRATION_GUIDE.md for detailed instructions

# Run database migrations (if configured)
npm run typeorm migration:run
```

For detailed AWS S3 setup instructions, see [S3_MIGRATION_GUIDE.md](S3_MIGRATION_GUIDE.md).

## Running the Application

```bash
# Development mode with watch
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (sets HttpOnly cookie)
- `POST /auth/logout` - Logout (clears cookie)

### Files
- `POST /files/upload` - Upload file(s)
- `GET /files/:id` - Get file metadata
- `GET /files/:id/download` - Download file
- `DELETE /files/:id` - Soft delete file
- `POST /files/:id/restore` - Restore from trash

### Folders
- `POST /folders` - Create folder
- `GET /folders/:id` - Get folder details and contents
- `PATCH /folders/:id` - Update folder name
- `DELETE /folders/:id` - Soft delete folder
- `POST /folders/:id/restore` - Restore folder

### Sharing
- `POST /sharing/share` - Share file/folder with user
- `GET /sharing/shared-with-me` - List items shared with current user
- `DELETE /sharing/:id` - Remove share

### Search
- `GET /search?q=query` - Search files and folders

### Trash
- `GET /trash` - List deleted items
- `DELETE /trash/:id` - Permanently delete item

### Versions
- `GET /versions/:fileId` - List file versions
- `POST /versions/:versionId/restore` - Restore specific version

## Project Structure

```
src/
├── auth/                  # Authentication module
│   ├── decorators/        # Custom decorators (@CurrentUser)
│   ├── dto/               # Login/Register DTOs
│   ├── guards/            # JWT auth guard
│   └── providers/         # Auth service, JWT strategy
├── common/                # Shared constants and utilities
│   ├── storage.constants.ts  # DEFAULT_STORAGE_QUOTA_BYTES
│   └── s3-storage.service.ts # AWS S3 storage service
├── database/              # TypeORM entities
│   ├── file.entity.ts     # File metadata
│   ├── folder.entity.ts   # Folder hierarchy
│   ├── user.entity.ts     # User accounts
│   └── user-share.entity.ts # Sharing permissions
├── files/                 # File operations module
│   ├── dtos/              # File upload DTOs
│   └── providers/         # Files service with quota enforcement
│       ├── files.service.ts    # File operations with S3 integration
│       └── preview.service.ts  # Thumbnail generation with S3
├── folders/               # Folder operations module
│   ├── dtos/              # Folder DTOs
│   └── providers/         # Folders service with size calculation
├── sharing/               # Sharing module
│   ├── dtos/              # Share DTOs
│   └── providers/         # Sharing service with inheritance logic
├── search/                # Search functionality
├── trash/                 # Trash/restore operations
├── versions/              # File version management
└── main.ts                # Application entry point
```

## Key Implementation Details

### Storage Quota Enforcement

Location: `src/files/providers/files.service.ts`

```typescript
async assertWithinQuota(userId: string, incomingBytes: number, currentFileSize = 0) {
  const quota = await this.getUserQuota(userId);
  const used = await this.getStorageUsed(userId);
  const newTotal = used - currentFileSize + incomingBytes;
  
  if (newTotal > quota) {
    throw new ForbiddenException('Storage quota exceeded');
  }
}
```

### Folder Size Calculation

Location: `src/folders/providers/folders.service.ts`

Uses BFS traversal to sum all file sizes recursively, excluding soft-deleted items.

### Permission Inheritance

Location: `src/sharing/providers/sharing.service.ts`

Checks direct shares and ancestor folder shares to determine access rights.

### AWS S3 Storage Integration

Location: `src/common/s3-storage.service.ts`

All files and thumbnails are stored in AWS S3:
- **File uploads**: Streamed directly to S3 with key pattern `users/{userId}/files/{fileId}{ext}`
- **File downloads**: Streamed from S3 to client
- **Thumbnails**: Generated on-demand and cached in S3 at `thumbnails/{fileId}.webp`
- **Supports**: AWS S3, MinIO, LocalStack, and other S3-compatible services

See [S3_MIGRATION_GUIDE.md](S3_MIGRATION_GUIDE.md) for setup and migration instructions.

## Database Schema

### Key Entities

- **User**: id, email, password, storageQuota (5GB default), createdAt
- **File**: id, name, mimeType, size, path, isDeleted, owner, folder, versions
- **Folder**: id, name, isDeleted, owner, parent, children
- **UserShare**: id, user, item (file/folder), permission (view/edit)
- **FileVersion**: id, file, path, size, version, createdAt

## Security Considerations

- Passwords hashed with bcrypt
- JWT tokens in HttpOnly cookies (prevents XSS)
- CORS configured for frontend origin
- Permission checks on all file/folder operations
- Input validation with class-validator
- SQL injection protection via TypeORM parameterized queries

## Performance Notes

- Folder size calculation is recursive (may be slow for deep hierarchies)
- Consider caching folder sizes for frequently accessed folders
- File uploads stream directly to disk
- Database indexes on userId, folderId, isDeleted fields

## License

This project is licensed under the MIT License.
