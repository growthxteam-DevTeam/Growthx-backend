import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import { MailService } from 'src/utility/mail/mail.service';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const ONE_DAY_SECONDS = 60 * 60 * 24;
const TOKEN_TTL_SECONDS = ONE_DAY_SECONDS;
const REMEMBER_ME_TOKEN_TTL_SECONDS = ONE_DAY_SECONDS * 30;

// Compared against when no account matches, so response time doesn't reveal whether an email is registered.
const DUMMY_PASSWORD_HASH =
  '$2b$10$zU70Fw49XVaXiMRHZum0L.2.Nc99K41UNJ2oZ/wyI/ETpxW/OYb3a';

const PASSWORD_SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Only the hash is stored, so a database leak doesn't hand out working reset links.
const hashResetToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// Shared by both lookups: emails are stored as typed at submission, so match case-insensitively.
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
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

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ status: string; statusCode: number; message: string }> {
    const where = {
      'applicationPortal.email': {
        $regex: `^${escapeRegExp(dto.email.trim())}$`,
        $options: 'i',
      },
      passwordHash: { $ne: null },
    } as unknown as FindOptionsWhere<ApplicationEntity>;
    const application = await this.applicationsRepository.findOne({ where });

    if (application) {
      const token = randomBytes(32).toString('hex');
      application.passwordResetTokenHash = hashResetToken(token);
      application.passwordResetExpiresAt = new Date(
        Date.now() + RESET_TOKEN_TTL_MS,
      );
      await this.applicationsRepository.save(application);

      // Not awaited: a mail outage must not change the response (and so reveal the account exists).
      void this.mailService
        .sendPasswordReset({
          to: application.applicationPortal.email,
          firstName: application.personalInfo.firstName,
          token,
        })
        .catch((error: unknown) =>
          this.logger.error(
            `Failed to send password-reset email for ${String(application._id)}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    return {
      status: 'Success',
      statusCode: 200,
      message:
        'If an account exists for that email, a password reset link has been sent',
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ status: string; statusCode: number; message: string }> {
    const application = await this.applicationsRepository.findOneBy({
      passwordResetTokenHash: hashResetToken(dto.token),
    });

    if (
      !application?.passwordResetExpiresAt ||
      application.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    application.passwordHash = await bcrypt.hash(
      dto.password,
      PASSWORD_SALT_ROUNDS,
    );
    // Single use: a second attempt with the same link is rejected.
    application.passwordResetTokenHash = null;
    application.passwordResetExpiresAt = null;
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      message: 'Password reset successfully',
    };
  }
}
