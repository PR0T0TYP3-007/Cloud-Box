import { IsString, IsUUID } from "class-validator";

export class FoldersDto {

    @IsString()
    name: string;

    @IsUUID()
    parentId: string;
}