import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';

import type { DashboardItemType } from './dashboard.constants';
import {
  CreateDashboardItemDto,
  UpdateDashboardItemDto,
} from './dto/dashboard-item.dto';
import { UpsertBannerDto } from './dto/upsert-banner.dto';
import { DashboardBannerEntity } from './entities/dashboard-banner.entity';
import { DashboardItemEntity } from './entities/dashboard-item.entity';

const toItemView = (item: DashboardItemEntity) => ({
  id: String(item._id),
  type: item.type,
  program: item.program,
  cohort: item.cohort,
  text: item.text,
  date: item.date,
  points: item.points,
  createdAt: item.createdAt,
});

const toBannerView = (banner: DashboardBannerEntity) => ({
  id: String(banner._id),
  program: banner.program,
  cohort: banner.cohort,
  title: banner.title,
  durationWeeks: banner.durationWeeks,
  leader: banner.leader,
  cohortMembers: banner.cohortMembers,
});

const toObjectId = (id: string, label: string) => {
  if (!ObjectId.isValid(id)) throw new NotFoundException(`${label} not found`);
  return new ObjectId(id);
};

// What the admin portal edits: the banners, announcements, events and assignments that
// DashboardService later resolves per learner.
@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(DashboardItemEntity)
    private readonly itemsRepository: Repository<DashboardItemEntity>,
    @InjectRepository(DashboardBannerEntity)
    private readonly bannersRepository: Repository<DashboardBannerEntity>,
  ) {}

  // Announcements newest first; events and assignments by date, soonest first.
  async listItems(type: DashboardItemType) {
    const items = await this.itemsRepository.find({
      where: { type },
      order:
        type === 'announcement'
          ? { createdAt: 'DESC', _id: 'DESC' }
          : { date: 'ASC', _id: 'ASC' },
    });

    return { status: 'Success', statusCode: 200, data: items.map(toItemView) };
  }

  async createItem(dto: CreateDashboardItemDto) {
    const isAnnouncement = dto.type === 'announcement';
    const item = await this.itemsRepository.save(
      this.itemsRepository.create({
        type: dto.type,
        program: dto.program ?? null,
        cohort: dto.cohort ?? null,
        text: dto.text.trim(),
        date: isAnnouncement ? null : (dto.date ?? null),
        points: dto.type === 'assignment' ? (dto.points ?? null) : null,
      }),
    );

    return { status: 'Success', statusCode: 201, data: toItemView(item) };
  }

  async updateItem(id: string, dto: UpdateDashboardItemDto) {
    const item = await this.findItem(id);

    // null is meaningful here ("everyone"), undefined means "leave as is".
    if (dto.program !== undefined) item.program = dto.program;
    if (dto.cohort !== undefined) item.cohort = dto.cohort;
    if (dto.text !== undefined) item.text = dto.text.trim();
    if (dto.date !== undefined && item.type !== 'announcement') {
      item.date = dto.date;
    }
    if (dto.points !== undefined && item.type === 'assignment') {
      item.points = dto.points;
    }
    await this.itemsRepository.save(item);

    return { status: 'Success', statusCode: 200, data: toItemView(item) };
  }

  async removeItem(id: string) {
    await this.itemsRepository.remove(await this.findItem(id));
    return { status: 'Success', statusCode: 200, message: 'Item deleted' };
  }

  async listBanners() {
    const banners = await this.bannersRepository.find({
      order: { program: 'ASC', cohort: 'ASC' },
    });
    return {
      status: 'Success',
      statusCode: 200,
      data: banners.map(toBannerView),
    };
  }

  // One banner per program + cohort: saving an existing pair replaces its content.
  async upsertBanner(dto: UpsertBannerDto) {
    const banner =
      (await this.bannersRepository.findOneBy({
        program: dto.program,
        cohort: dto.cohort,
      })) ?? this.bannersRepository.create();

    Object.assign(banner, {
      program: dto.program,
      cohort: dto.cohort,
      title: dto.title.trim(),
      durationWeeks: dto.durationWeeks,
      leader: dto.leader.trim(),
      cohortMembers: dto.cohortMembers,
    });
    await this.bannersRepository.save(banner);

    return { status: 'Success', statusCode: 200, data: toBannerView(banner) };
  }

  async removeBanner(id: string) {
    const banner = await this.bannersRepository.findOneBy({
      _id: toObjectId(id, 'Banner'),
    });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.bannersRepository.remove(banner);
    return { status: 'Success', statusCode: 200, message: 'Banner deleted' };
  }

  private async findItem(id: string): Promise<DashboardItemEntity> {
    const item = await this.itemsRepository.findOneBy({
      _id: toObjectId(id, 'Item'),
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }
}
