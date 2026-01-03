import { IsArray, IsUUID, IsOptional, IsEnum } from 'class-validator';

export enum ItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class BatchItem {
  @IsUUID()
  id: string;

  @IsEnum(ItemType)
  type: ItemType;
}

export class BatchDeleteDto {
  @IsArray()
  items: BatchItem[];
}

export class BatchMoveDto {
  @IsArray()
  items: BatchItem[];

  @IsUUID()
  @IsOptional()
  targetFolderId: string | null;
}

export class BatchRestoreDto {
  @IsArray()
  items: BatchItem[];
}
