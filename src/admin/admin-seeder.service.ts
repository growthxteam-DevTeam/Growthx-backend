import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AdminEntity } from './entities/admin.entity';

const PASSWORD_SALT_ROUNDS = 10;

// Used only outside production, so a fresh checkout has a login. Documented in README.md.
const DEV_ADMIN = {
  name: 'Growth X Admin',
  email: 'admin@growthx.com',
  password: 'GrowthX@Admin2026',
};

// Creates the admin account (the "password document" in the `admins` collection) on boot.
// An existing admin is left alone, except that an explicitly set ADMIN_PASSWORD is applied to it, so
// editing .env after the first boot takes effect. The built-in dev defaults never overwrite anything.
@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminsRepository: Repository<AdminEntity>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const email = (
      this.config.get<string>('ADMIN_EMAIL') ??
      (isProduction ? undefined : DEV_ADMIN.email)
    )
      ?.trim()
      .toLowerCase();
    const configuredPassword = this.config.get<string>('ADMIN_PASSWORD');
    const password =
      configuredPassword ?? (isProduction ? undefined : DEV_ADMIN.password);

    if (!email || !password) {
      this.logger.warn(
        'No admin seeded: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin in production',
      );
      return;
    }

    const existing = await this.adminsRepository.findOneBy({ email });
    if (existing) {
      if (
        configuredPassword &&
        !(await bcrypt.compare(configuredPassword, existing.passwordHash))
      ) {
        existing.passwordHash = await bcrypt.hash(
          configuredPassword,
          PASSWORD_SALT_ROUNDS,
        );
        await this.adminsRepository.save(existing);
        this.logger.log(
          `Updated admin password for ${email} from ADMIN_PASSWORD`,
        );
      }
      return;
    }

    await this.adminsRepository.save(
      this.adminsRepository.create({
        name: this.config.get<string>('ADMIN_NAME') ?? DEV_ADMIN.name,
        email,
        passwordHash: await bcrypt.hash(password, PASSWORD_SALT_ROUNDS),
      }),
    );
    this.logger.log(`Seeded admin account for ${email}`);
  }
}
