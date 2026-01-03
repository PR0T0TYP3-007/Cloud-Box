import { Controller, Post, UseInterceptors, UploadedFile, UploadedFiles, Body, Inject, BadRequestException, Get, Param, Res, NotFoundException, Patch, Delete, Req } from '@nestjs/common';
import { FilesService } from './providers/files.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CurrentUser } from 'src/auth/decorators';
import type { Response, Request } from 'express';
import { RenameFileDto } from './dtos/rename-file.dto';
import { MoveFileDto } from './dtos/move-file.dto';
import { BatchDeleteDto, BatchMoveDto, BatchRestoreDto } from './dtos/batch-operation.dto';
import { ActivityService } from 'src/activity/providers/activity.service';
import { ActivityAction } from 'src/database/activity-log.entity';
import { FolderService } from 'src/folders/providers/folders.service';
import { SharingService } from 'src/sharing/providers/sharing.service';
import { PreviewService } from './providers/preview.service';

@Controller('files')
export class FilesController {
  constructor(
    @Inject(FilesService)
    private readonly filesService: FilesService,
    private readonly activityService: ActivityService,
    private readonly folderService: FolderService,
    private readonly sharingService: SharingService,
    private readonly previewService: PreviewService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadFile(@CurrentUser() user: any, @UploadedFile() file: any, @Body('folderId') folderId?: string, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.filesService.uploadFile(userId, folderId ?? null, { originalname: file.originalname, buffer: file.buffer });
    
    // Log activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.FILE_UPLOAD,
      resourceType: 'file',
      resourceId: result.file.id,
      resourceName: result.file.name,
      metadata: { size: result.file.size, folderId },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
    
    return {
      message: 'Uploaded',
      data: {
        file: {
          id: result.file.id,
          name: result.file.name,
          size: result.file.size,
          currentVersion: result.file.currentVersion,
          storagePath: result.file.storagePath,
        },
        version: {
          id: result.version.id,
          version: result.version.version,
          storageKey: result.version.storageKey,
          checksum: result.version.checksum,
          size: result.version.size,
        }
      }
    };
  }

  // Upload multiple files with paths. `files` is multipart file array and `paths` is a JSON array of relative paths matching order.
  @Post('upload-multi')
  @UseInterceptors(FilesInterceptor('files', 100, { storage: multer.memoryStorage() }))
  async uploadFilesMulti(@CurrentUser() user: any, @UploadedFiles() files: any[], @Body('paths') pathsJson: string, @Body('baseFolderId') baseFolderId?: string) {
    const userId = user?.sub ?? user?.id;
    // Delegate validation and processing to service
    const result = await this.filesService.uploadFilesMultipart(userId, files as any[], pathsJson, baseFolderId);
    return { message: 'Uploaded', data: result };
  }

  @Get(':id/download')
  async downloadFile(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    const { stream, name, fileId } = await this.filesService.getFileStream(userId, id);
    
    // Log activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.FILE_DOWNLOAD,
      resourceType: 'file',
      resourceId: fileId,
      resourceName: name,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
    
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    stream.once('error', (err) => {
      console.error('Stream error', err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  }

  @Patch(':id/rename')
  async renameFile(@CurrentUser() user: any, @Param('id') id: string, @Body() body: RenameFileDto) {
    const userId = user?.sub ?? user?.id;
    const file = await this.filesService.renameFile(userId, id, body.name);
    return { message: 'Renamed', data: { file: { id: file.id, name: file.name } } };
  }

  @Delete(':id')
  async deleteFile(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    await this.filesService.deleteFile(userId, id);
    return { message: 'Deleted', data: null };
  }

  @Delete(':id/permanent')
  async permanentlyDeleteFile(@CurrentUser() user: any, @Param('id') id: string, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    await this.filesService.permanentlyDeleteFile(userId, id);
    
    // Log activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.FILE_DELETE,
      resourceType: 'file',
      resourceId: id,
      metadata: { permanent: true },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
    
    return { message: 'Permanently deleted', data: null };
  }

  @Post(':id/restore')
  async restoreFile(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    const file = await this.filesService.restoreFile(userId, id);
    return { message: 'Restored', data: { file: { id: file.id, name: file.name } } };
  }

  @Post(':id/move')
  async moveFile(@CurrentUser() user: any, @Param('id') id: string, @Body() body: MoveFileDto, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    const file = await this.filesService.moveFile(userId, id, body.targetFolderId ?? null);
    
    // Log activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.FILE_MOVE,
      resourceType: 'file',
      resourceId: file.id,
      resourceName: file.name,
      metadata: { targetFolderId: body.targetFolderId },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
    
    return { message: 'Moved', data: { file: { id: file.id, name: file.name, folderId: file.folder?.id ?? null } } };
  }

  @Post('batch/delete')
  async batchDelete(@CurrentUser() user: any, @Body() body: BatchDeleteDto, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    const results: { successes: any[]; errors: any[] } = { successes: [], errors: [] };

    for (const item of body.items) {
      try {
        if (item.type === 'file') {
          await this.filesService.deleteFile(userId, item.id);
        } else {
          await this.folderService.deleteFolder(userId, item.id, true);
        }
        results.successes.push({ id: item.id, type: item.type });
      } catch (error) {
        results.errors.push({ id: item.id, type: item.type, error: error.message });
      }
    }

    // Log batch activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.BATCH_DELETE,
      metadata: { count: body.items.length, successes: results.successes.length, errors: results.errors.length },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });

    return { message: 'Batch delete completed', data: results };
  }

  @Post('batch/move')
  async batchMove(@CurrentUser() user: any, @Body() body: BatchMoveDto, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    const results: { successes: any[]; errors: any[] } = { successes: [], errors: [] };

    for (const item of body.items) {
      try {
        if (item.type === 'file') {
          await this.filesService.moveFile(userId, item.id, body.targetFolderId);
        } else {
          await this.folderService.moveFolder(userId, item.id, body.targetFolderId);
        }
        results.successes.push({ id: item.id, type: item.type });
      } catch (error) {
        results.errors.push({ id: item.id, type: item.type, error: error.message });
      }
    }

    // Log batch activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.BATCH_MOVE,
      metadata: { count: body.items.length, targetFolderId: body.targetFolderId, successes: results.successes.length, errors: results.errors.length },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });

    return { message: 'Batch move completed', data: results };
  }

  @Post('batch/restore')
  async batchRestore(@CurrentUser() user: any, @Body() body: BatchRestoreDto, @Req() req?: Request) {
    const userId = user?.sub ?? user?.id;
    const results: { successes: any[]; errors: any[] } = { successes: [], errors: [] };

    for (const item of body.items) {
      try {
        if (item.type === 'file') {
          await this.filesService.restoreFile(userId, item.id);
        } else {
          await this.folderService.restoreFolder(userId, item.id);
        }
        results.successes.push({ id: item.id, type: item.type });
      } catch (error) {
        results.errors.push({ id: item.id, type: item.type, error: error.message });
      }
    }

    // Log batch activity
    await this.activityService.logActivity({
      user: { id: userId } as any,
      action: ActivityAction.BATCH_RESTORE,
      metadata: { count: body.items.length, successes: results.successes.length, errors: results.errors.length },
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });

    return { message: 'Batch restore completed', data: results };
  }

  @Get(':id/thumbnail')
  async getThumbnail(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const userId = user?.sub ?? user?.id;
    const { buffer, contentType } = await this.previewService.getThumbnail(userId, id);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(buffer);
  }

  @Get(':id/preview')
  async getPreview(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const userId = user?.sub ?? user?.id;
    const { stream, contentType, size } = await this.previewService.getPreview(userId, id);
    
    res.setHeader('Content-Type', contentType);
    if (size) res.setHeader('Content-Length', size.toString());
    
    stream.once('error', (err) => {
      console.error('Preview stream error', err);
      if (!res.headersSent) res.status(500).end();
    });
    
    stream.pipe(res);
  }

  @Get(':id/metadata')
  async getMetadata(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    const metadata = await this.previewService.getFileMetadata(userId, id);
    return { message: 'OK', data: metadata };
  }
}
