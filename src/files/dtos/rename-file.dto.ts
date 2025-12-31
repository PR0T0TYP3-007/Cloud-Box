import { IsString, IsNotEmpty } from 'class-validator';

export class RenameFileDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
