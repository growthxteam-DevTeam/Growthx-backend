import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CloudinaryService } from 'src/utility/cloudinary/cloudinary.service';
import { ApplicationStatus } from 'src/utility/common/application-status.enum';

import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationEntity } from './entities/application.entity';

const PASSPORT_PHOTO_CLOUDINARY_FOLDER = 'growth-x/passport-photos';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    dto: CreateApplicationDto,
    passportPhoto?: Express.Multer.File,
  ): Promise<{ status: string; statusCode: number; data: ApplicationEntity }> {
    const passportPhotoUrl = passportPhoto
      ? (await this.cloudinaryService.uploadImage(passportPhoto, PASSPORT_PHOTO_CLOUDINARY_FOLDER))
          .secure_url
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
      },
      submit: {
        passportPhotoUrl,
      },
      status: ApplicationStatus.PENDING,
    });

    const data = await this.applicationsRepository.save(application);

    return { status: 'Success', statusCode: 201, data };
  }
}
