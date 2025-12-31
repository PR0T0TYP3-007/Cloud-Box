import { IsOptional, IsString } from 'class-validator';

export class MoveFolderDto {
  @IsOptional()
  @IsString()
  targetFolderId?: string | null;
}
