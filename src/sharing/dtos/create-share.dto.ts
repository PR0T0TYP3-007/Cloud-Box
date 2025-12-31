import { IsEmail, IsIn, IsUUID } from 'class-validator';

export class CreateShareDto {
  @IsUUID()
  itemId: string;

  @IsIn(['file', 'folder'])
  itemType: 'file' | 'folder';

  @IsEmail()
  email: string;

  @IsIn(['view', 'edit'])
  permission: 'view' | 'edit';
}
