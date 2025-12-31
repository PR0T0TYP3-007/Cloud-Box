import { IsString, IsNotEmpty } from 'class-validator';

export class RenameFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
