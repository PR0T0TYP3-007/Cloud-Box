import { IsString, IsUUID, IsOptional } from "class-validator";

export class FoldersDto {

    @IsString()
    name: string;

    @IsOptional()
    @IsUUID()
    parentId?: string;
}