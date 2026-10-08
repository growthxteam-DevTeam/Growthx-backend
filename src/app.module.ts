import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { DiscussionsModule } from './discussions/discussions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mongodb',
        url: config.get<string>('MONGODB_URI'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        useUnifiedTopology: true,
        synchronize: true,
      }),
    }),
    ApplicationsModule,
    AuthModule,
    DiscussionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
