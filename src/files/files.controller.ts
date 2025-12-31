import { Controller, Post, UseInterceptors, UploadedFile, UploadedFiles, Body, Inject, BadRequestException, Get, Param, Res, NotFoundException, Patch, Delete } from '@nestjs/common';
import { FilesService } from './providers/files.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CurrentUser } from 'src/auth/decorators';
import type { Response } from 'express';
import { RenameFileDto } from './dtos/rename-file.dto';
import { MoveFileDto } from './dtos/move-file.dto';

@Controller('files')
export class FilesController {
  constructor(
    @Inject(FilesService)
    private readonly filesService: FilesService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadFile(@CurrentUser() user: any, @UploadedFile() file: any, @Body('folderId') folderId?: string) {
    const userId = user?.sub ?? user?.id;
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.filesService.uploadFile(userId, folderId ?? null, { originalname: file.originalname, buffer: file.buffer });
    return {
      message: 'Uploaded',
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
    };
  }

  // Upload multiple files with paths. `files` is multipart file array and `paths` is a JSON array of relative paths matching order.
  @Post('upload-multi')
  @UseInterceptors(FilesInterceptor('files', 100, { storage: multer.memoryStorage() }))
  async uploadFilesMulti(@CurrentUser() user: any, @UploadedFiles() files: any[], @Body('paths') pathsJson: string) {
    const userId = user?.sub ?? user?.id;
    // Delegate validation and processing to service
    const result = await this.filesService.uploadFilesMultipart(userId, files as any[], pathsJson);
    return result;
  }

  @Get(':id/download')
  async downloadFile(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const userId = user?.sub ?? user?.id;
    const { stream, name } = await this.filesService.getFileStream(userId, id);
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
    return { message: 'Renamed', file: { id: file.id, name: file.name } };
  }

  @Delete(':id')
  async deleteFile(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    await this.filesService.deleteFile(userId, id);
    return { message: 'Deleted' };
  }

  @Post(':id/move')
  async moveFile(@CurrentUser() user: any, @Param('id') id: string, @Body() body: MoveFileDto) {
    const userId = user?.sub ?? user?.id;
    const file = await this.filesService.moveFile(userId, id, body.targetFolderId ?? null);
    return { message: 'Moved', file: { id: file.id, name: file.name, folderId: file.folder?.id ?? null } };
  }
}
