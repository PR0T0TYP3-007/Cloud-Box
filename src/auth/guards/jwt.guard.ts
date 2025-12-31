import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @Public() metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');

    const parts = authHeader.split(' ');
    if (parts.length !== 2) throw new UnauthorizedException('Invalid Authorization header');
    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) throw new UnauthorizedException('Invalid Authorization header');

    try {
      const payload = this.jwtService.verify(token);
      // attach payload for later retrieval
      req.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}