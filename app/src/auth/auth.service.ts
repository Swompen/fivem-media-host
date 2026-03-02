import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const adminUsername = this.configService.getOrThrow<string>('ADMIN_USERNAME');
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');

    // Always evaluate both comparisons before checking result
    // Prevents attackers from distinguishing valid usernames via timing
    const usernameMatch =
      loginDto.username.length === adminUsername.length &&
      timingSafeEqual(
        Buffer.from(loginDto.username),
        Buffer.from(adminUsername),
      );

    const passwordMatch =
      loginDto.password.length === adminPassword.length &&
      timingSafeEqual(
        Buffer.from(loginDto.password),
        Buffer.from(adminPassword),
      );

    // Use bitwise AND to ensure both comparisons are evaluated
    const valid = Number(usernameMatch) & Number(passwordMatch);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: adminUsername, role: 'admin' };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
