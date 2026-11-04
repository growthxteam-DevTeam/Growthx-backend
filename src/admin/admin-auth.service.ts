import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { ADMIN_ROLE, type AdminTokenPayload } from './admin-token.type';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminEntity } from './entities/admin.entity';

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 8;

// Compared against when no admin matches, so response time doesn't reveal whether an email exists.
const DUMMY_PASSWORD_HASH =
  '$2b$10$zU70Fw49XVaXiMRHZum0L.2.Nc99K41UNJ2oZ/wyI/ETpxW/OYb3a';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminsRepository: Repository<AdminEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.adminsRepository.findOneBy({
      email: dto.email.trim().toLowerCase(),
    });

    const passwordMatches = await bcrypt.compare(
      dto.password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!admin || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: AdminTokenPayload = {
      sub: String(admin._id),
      email: admin.email,
      role: ADMIN_ROLE,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ADMIN_TOKEN_TTL_SECONDS,
    });

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        accessToken,
        admin: { id: String(admin._id), name: admin.name, email: admin.email },
      },
    };
  }
}
