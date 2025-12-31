import { Injectable } from "@nestjs/common";
import { HashingProvider } from "./hashing.provider";
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptProvider implements HashingProvider {

  async hash(data: string): Promise<string> {
    // Implementation for hashing data
    const salt = await bcrypt.genSalt();
    return await bcrypt.hash(data, salt);
  }

  async compare(data: string, hashedData: string): Promise<boolean> {
    // Implementation for comparing data with hashed data
    return await bcrypt.compare(data, hashedData);
  }
}