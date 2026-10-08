import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';

import { LoginDto } from './dto/login.dto';

const ONE_DAY_SECONDS = 60 * 60 * 24;
const TOKEN_TTL_SECONDS = ONE_DAY_SECONDS;
const REMEMBER_ME_TOKEN_TTL_SECONDS = ONE_DAY_SECONDS * 30;

// Compared against when no account matches, so response time doesn't reveal whether an email is registered.
const DUMMY_PASSWORD_HASH =
  '$2b$10$zU70Fw49XVaXiMRHZum0L.2.Nc99K41UNJ2oZ/wyI/ETpxW/OYb3a';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    // Only applications that have set a password (via create-password) can log in.
    // Emails are stored as typed at submission, so match case-insensitively.
    const where = {
      'applicationPortal.email': {
        $regex: `^${escapeRegExp(dto.email.trim())}$`,
        $options: 'i',
      },
      passwordHash: { $ne: null },
    } as unknown as FindOptionsWhere<ApplicationEntity>;
    const application = await this.applicationsRepository.findOne({ where });

    const passwordMatches = await bcrypt.compare(
      dto.password,
      application?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!application || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: String(application._id),
        email: application.applicationPortal.email,
      },
      {
        expiresIn: dto.rememberMe
          ? REMEMBER_ME_TOKEN_TTL_SECONDS
          : TOKEN_TTL_SECONDS,
      },
    );

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        accessToken,
        user: {
          id: String(application._id),
          name: application.applicationPortal.fullName,
          email: application.applicationPortal.email,
          profilePicture: application.submit?.passportPhotoUrl ?? null,
        },
      },
    };
  }
}
