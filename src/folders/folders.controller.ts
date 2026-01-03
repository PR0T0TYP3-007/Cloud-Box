import { Controller, Get, Post, Body, Inject, Query, Patch, Delete, Param, BadRequestException, Res } from '@nestjs/common';
import { FoldersDto } from './dtos/folders.dto';
import { FolderService } from './providers/folders.service';
import { CurrentUser } from 'src/auth/decorators';
import { RenameFolderDto } from './dtos/rename-folder.dto';
import { MoveFolderDto } from './dtos/move-folder.dto';
import type { Response } from 'express';


@Controller('folders')
export class FoldersController {

    constructor(
        @Inject(FolderService)
        private readonly folderService: FolderService
    ) {}

    @Get()
    async getFolders(@CurrentUser() user: any, @Query('folderId') folderId?: string) {
        const userId = user?.sub ?? user?.id ?? user?.userId ?? null;
        // If folderId is provided, return the parent name, the folder info, and its children.
        // If not provided, return the user's root folder view.
        const view = await this.folderService.getFolderView(userId, folderId);
        return { message: 'OK', data: view };
    }

    @Post()
    async createFolder(@CurrentUser() user: any, @Body() FoldersDto: FoldersDto) {
        const userId = user?.sub ?? user?.id;
        // parentId required in DTO for user-created folders
        const created = await this.folderService.createFolder(userId, { name: FoldersDto.name, parentId: FoldersDto.parentId });
        // Return the same structure as GET /folders (parentName, folder, children)
        const view = await this.folderService.getFolderView(userId, created.id);
        return { message: 'Created', data: view };
    }

    @Patch(':id/rename')
    async renameFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() body: RenameFolderDto) {
        const userId = user?.sub ?? user?.id;
        const f = await this.folderService.renameFolder(userId, id, body.name);
        return { message: 'Renamed', data: { folder: { id: f.id, name: f.name } } };
    }

    @Post(':id/move')
    async moveFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() body: MoveFolderDto) {
        const userId = user?.sub ?? user?.id;
        const f = await this.folderService.moveFolder(userId, id, body.targetFolderId ?? null);
        return { message: 'Moved', data: { folder: { id: f.id, name: f.name, parentId: f.parent?.id ?? null } } };
    }

    @Delete(':id')
    async deleteFolder(@CurrentUser() user: any, @Param('id') id: string, @Query('recursive') recursive?: string) {
        const userId = user?.sub ?? user?.id;
        const isRecursive = recursive === 'true' || recursive === '1';
        await this.folderService.deleteFolder(userId, id, isRecursive);
        return { message: 'Deleted', data: null };
    }

    @Delete(':id/permanent')
    async permanentlyDeleteFolder(@CurrentUser() user: any, @Param('id') id: string) {
        const userId = user?.sub ?? user?.id;
        await this.folderService.permanentlyDeleteFolder(userId, id);
        return { message: 'Permanently deleted', data: null };
    }

    @Post(':id/restore')
    async restoreFolder(@CurrentUser() user: any, @Param('id') id: string) {
        const userId = user?.sub ?? user?.id;
        const folder = await this.folderService.restoreFolder(userId, id);
        return { message: 'Restored', data: { folder: { id: folder.id, name: folder.name } } };
    }

    @Get(':id/ancestors')
    async getAncestors(@CurrentUser() user: any, @Param('id') id: string) {
        const userId = user?.sub ?? user?.id;
        const ancestors = await this.folderService.getAncestors(userId, id);
        return { message: 'OK', data: ancestors };
    }

    @Get(':id/download')
    async downloadFolder(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
        const userId = user?.sub ?? user?.id;
        const { zipStream, folderName } = await this.folderService.downloadFolderAsZip(userId, id);
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
        
        zipStream.pipe(res);
        
        zipStream.on('error', (err) => {
            console.error('Zip stream error:', err);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
    }
}
