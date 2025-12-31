import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class HashingProvider {
    abstract hash(data: string): Promise<string>;
    
    abstract compare(data: string, hashedData: string): Promise<boolean>;
}