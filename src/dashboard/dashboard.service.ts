import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';

import { MAX_ANNOUNCEMENTS, MAX_TODOS } from './dashboard.constants';
import { DashboardBannerEntity } from './entities/dashboard-banner.entity';
import { DashboardItemEntity } from './entities/dashboard-item.entity';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// `$in` and null matching don't type-check in TypeORM where clauses (same workaround as the
// discussions service).
const mongoWhere = (where: object) =>
  where as unknown as FindOptionsWhere<DashboardItemEntity>;

// The learner dashboard: everything the admin published for the caller's program and cohort, plus
// whatever is addressed to everyone.
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DashboardItemEntity)
    private readonly itemsRepository: Repository<DashboardItemEntity>,
    @InjectRepository(DashboardBannerEntity)
    private readonly bannersRepository: Repository<DashboardBannerEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
  ) {}

  async getForApplicant(applicationId: string) {
    const application = ObjectId.isValid(applicationId)
      ? await this.applicationsRepository.findOneBy({
          _id: new ObjectId(applicationId),
        })
      : null;
    if (!application) throw new NotFoundException('Application not found');

    const { program } = application.applicationPortal;
    const cohort = application.applicationPortal.cohort ?? null;
    const audience = {
      program: { $in: [null, program] },
      cohort: { $in: [null, cohort] },
    };

    const [banner, announcements, events, assignments] = await Promise.all([
      cohort
        ? this.bannersRepository.findOneBy({ program, cohort })
        : Promise.resolve(null),
      this.itemsRepository.find({
        where: mongoWhere({ ...audience, type: 'announcement' }),
        order: { createdAt: 'DESC', _id: 'DESC' },
        take: MAX_ANNOUNCEMENTS,
      }),
      // From yesterday on, so today's events survive timezone differences.
      this.itemsRepository.find({
        where: mongoWhere({
          ...audience,
          type: 'event',
          date: { $gte: new Date(Date.now() - ONE_DAY_MS) },
        }),
        order: { date: 'ASC', _id: 'ASC' },
      }),
      // Past-due assignments drop off the to-do list (there is no submission tracking to clear them).
      this.itemsRepository.find({
        where: mongoWhere({
          ...audience,
          type: 'assignment',
          date: { $gte: new Date() },
        }),
        order: { date: 'ASC', _id: 'ASC' },
        take: MAX_TODOS,
      }),
    ]);

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        program,
        cohort,
        banner: banner && {
          title: banner.title,
          durationWeeks: banner.durationWeeks,
          leader: banner.leader,
          cohortMembers: banner.cohortMembers,
        },
        announcements: announcements.map((item) => ({
          id: String(item._id),
          text: item.text,
          createdAt: item.createdAt,
        })),
        events: events.map((item) => ({
          id: String(item._id),
          text: item.text,
          date: item.date,
        })),
        assignments: assignments.map((item) => ({
          id: String(item._id),
          text: item.text,
          date: item.date,
          points: item.points,
        })),
      },
    };
  }
}
