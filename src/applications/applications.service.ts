import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { CloudinaryService } from 'src/utility/cloudinary/cloudinary.service';
import { ApplicationStatus } from 'src/utility/common/application-status.enum';
import { generateGsCode } from 'src/utility/common/generate-gs-code';
import { MailService } from 'src/utility/mail/mail.service';

import { CreateApplicationDto } from './dto/create-application.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { ApplicationEntity } from './entities/application.entity';

const PASSWORD_SALT_ROUNDS = 10;

const PASSPORT_PHOTO_CLOUDINARY_FOLDER = 'growth-x/passport-photos';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  async create(
    dto: CreateApplicationDto,
    passportPhoto?: Express.Multer.File,
  ): Promise<{ status: string; statusCode: number; data: ApplicationEntity }> {
    const passportPhotoUrl = passportPhoto
      ? (
          await this.cloudinaryService.uploadImage(
            passportPhoto,
            PASSPORT_PHOTO_CLOUDINARY_FOLDER,
          )
        ).secure_url
      : undefined;

    // The wizard submits one flat payload, but the record is stored grouped
    // by the screen each field came from — see entities/application-groups.entity.ts.
    const application = this.applicationsRepository.create({
      applicationPortal: {
        fullName: dto.fullName,
        email: dto.email,
        program: dto.program,
        cohort: dto.cohort,
      },
      personalInfo: {
        title: dto.title,
        surname: dto.surname,
        firstName: dto.firstName,
        businessName: dto.businessName,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender,
      },
      businessBasics: {
        businessDescription: dto.businessDescription,
        operatingDuration: dto.operatingDuration,
        averageRevenue: dto.averageRevenue,
        fullTimeCommitment: dto.fullTimeCommitment,
      },
      whoYouAre: {
        challengeAndSkillGap: dto.challengeAndSkillGap,
        cohortMotivation: dto.cohortMotivation,
      },
      accessibilitySupport: {
        hasAccessibilityNeeds: dto.hasAccessibilityNeeds,
        accessibilityNeed: dto.accessibilityNeed,
      },
      submit: {
        passportPhotoUrl,
      },
      gsCode: generateGsCode(),
      status: ApplicationStatus.PENDING,
    });

    const data = await this.applicationsRepository.save(application);

    // Not awaited: a mail outage must not fail an already-saved application.
    void this.mailService
      .sendApplicationReceived({
        to: data.applicationPortal.email,
        firstName: data.personalInfo.firstName,
        gsCode: data.gsCode,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to send application-received email for ${String(data._id)}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );

    return { status: 'Success', statusCode: 201, data };
  }

  async createPassword(
    dto: CreatePasswordDto,
  ): Promise<{ status: string; statusCode: number; message: string }> {
    const application = await this.applicationsRepository.findOneBy({
      gsCode: dto.gsCode,
    });

    if (!application) {
      throw new BadRequestException('Invalid GS code');
    }
    if (application.passwordHash) {
      throw new ConflictException('This GS code has already been used');
    }

    application.passwordHash = await bcrypt.hash(
      dto.password,
      PASSWORD_SALT_ROUNDS,
    );
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      message: 'Password created successfully',
    };
  }
}
