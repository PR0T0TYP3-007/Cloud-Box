import { Controller, Get, Post, Body, Inject, Query, Patch, Delete, Param, BadRequestException } from '@nestjs/common';
import { FoldersDto } from './dtos/folders.dto';
import { FolderService } from './providers/folders.service';
import { CurrentUser } from 'src/auth/decorators';
import { RenameFolderDto } from './dtos/rename-folder.dto';
import { MoveFolderDto } from './dtos/move-folder.dto';


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
        return this.folderService.getFolderView(userId, folderId);
    }

    @Post()
    async createFolder(@CurrentUser() user: any, @Body() FoldersDto: FoldersDto) {
        const userId = user?.sub ?? user?.id;
        // parentId required in DTO for user-created folders
        const created = await this.folderService.createFolder(userId, { name: FoldersDto.name, parentId: FoldersDto.parentId });
        // Return the same structure as GET /folders (parentName, folder, children)
        return this.folderService.getFolderView(userId, created.id);
    }

    @Patch(':id/rename')
    async renameFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() body: RenameFolderDto) {
        const userId = user?.sub ?? user?.id;
        const f = await this.folderService.renameFolder(userId, id, body.name);
        return { message: 'Renamed', folder: { id: f.id, name: f.name } };
    }

    @Post(':id/move')
    async moveFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() body: MoveFolderDto) {
        const userId = user?.sub ?? user?.id;
        const f = await this.folderService.moveFolder(userId, id, body.targetFolderId ?? null);
        return { message: 'Moved', folder: { id: f.id, name: f.name, parentId: f.parent?.id ?? null } };
    }

    @Delete(':id')
    async deleteFolder(@CurrentUser() user: any, @Param('id') id: string, @Query('recursive') recursive?: string) {
        const userId = user?.sub ?? user?.id;
        const isRecursive = recursive === 'true' || recursive === '1';
        await this.folderService.deleteFolder(userId, id, isRecursive);
        return { message: 'Deleted' };
    }
}
