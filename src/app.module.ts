import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_GUARD } from "@nestjs/core";

import { AppController } from "./app.controller";
import { dataSourceOptions } from "../db/data-source";

import { TelegramModule } from "./modules/telegram/telegram.module";
import { AccountModule } from "@account/account.module";
import { StreamModule } from "./modules/stream/stream.module";
import { GradeModule } from "./modules/grade/grade.module";
import { SubjectModule } from "./modules/subject/subject.module";
import { TopicModule } from "./modules/topic/topic.module";
import { QuestionModule } from "./modules/question/question.module";
import { AttemptModule } from "./modules/attempt/attempt.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { AiModule } from "./modules/ai/ai.module";
import { PracticeModule } from "./modules/practice/practice.module";
import { MockModule } from "./modules/mock/mock.module";

import { UserStatusGuard } from "@account/auth/guards/user-validation.guard";

// synchronize: true only in local development.
// In production, schema changes are handled by TypeORM migrations.
const isProduction = process.env.NODE_ENV === "production";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: "short", ttl: 60000,  limit: 2000 }, // 2000/min — covers burst reads
      { name: "auth",  ttl: 900000, limit: 50   }, // 50 auth requests per 15 min per IP
    ]),
    EventEmitterModule.forRoot({
      maxListeners: 10,
      verboseMemoryLeak: true,
    }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      // Ensure all entity columns and tables are synchronized
      synchronize: true,
      migrationsRun: true,
      retryAttempts: 3,
      retryDelay: 3000,
      toRetry: () => true,
    }),

    AccountModule,
    TelegramModule,
    StreamModule,
    GradeModule,
    SubjectModule,
    TopicModule,
    QuestionModule,
    AttemptModule,
    FeedbackModule,
    NotificationModule,
    AnalyticsModule,
    SettingsModule,
    AiModule,
    PracticeModule,
    MockModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: UserStatusGuard },
  ],
})
export class AppModule {}
