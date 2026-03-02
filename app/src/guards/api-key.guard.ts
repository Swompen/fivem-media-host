import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expected = process.env.API_KEY;

    if (!apiKey || !expected) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Pad both buffers to equal length to prevent timing attacks on key length
    const a = Buffer.from(apiKey);
    const b = Buffer.from(expected);
    const len = Math.max(a.length, b.length);
    const padA = Buffer.concat([a, Buffer.alloc(len - a.length)]);
    const padB = Buffer.concat([b, Buffer.alloc(len - b.length)]);

    // Compare padded buffers AND verify actual lengths match
    try {
      const keysMatch = timingSafeEqual(padA, padB) && a.length === b.length;
      if (!keysMatch) {
        throw new UnauthorizedException('Invalid API key');
      }
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
