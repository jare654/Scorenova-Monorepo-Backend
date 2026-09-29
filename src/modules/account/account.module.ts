import { ResetPasswordTokenEntity } from "./models/reset-password/reset-password.entity";
import { AccountCommands } from "./usecases/accounts/account.usecase.commands";
import { AccountQuery } from "./usecases/accounts/account.usecase.queries";
import { AccountRepository } from "./models/accounts/account.repository";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RoleEntity } from "./models/roles/role.entity";
import { RoleRepository } from "./models/roles/role.repository";
import { RoleCommands } from "./usecases/roles/role.usecase.commands";
import { RoleQueries } from "./usecases/roles/role.usecase.queries";
import { RolesController } from "./controllers/role.controller";
import { PermissionsController } from "./controllers/permission.controller";
import { PermissionEntity } from "./models/permissions/permission.entity";
import { PermissionCommands } from "./usecases/permissions/permission.usecase.commands";
import { PermissionQueries } from "./usecases/permissions/permission.usecase.queries";
import { PermissionRepository } from "./models/permissions/permission.repository";
import { AccountRoleEntity } from "./models/accounts/account-role.entity";
import { RolePermissionEntity } from "./models/roles/role-permission.entity";
import { AccountsController } from "./controllers/account.controller";
import { AccountPermissionEntity } from "./models/accounts/account-permission.entity";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./auth/strategies/jwt.strategy";
import { AuthService } from "./auth/services/auth.service";
import { AuthFlowService } from "./auth/services/auth-flow.service";
import { AuthController } from "./controllers/auth.controller";
import { SessionEntity } from "./models/sessions/session.entity";
import { SessionRepository } from "./models/sessions/session.repository";
import { SessionCommands } from "./usecases/sessions/session.usecase.commands";
import { SessionQuery } from "./usecases/sessions/session.usecase.queries";
import { OtpEntity } from "./models/otp/otp.entity";
import { OtpService } from "./auth/services/otp.service";
import { PremiumExpiryService } from "./services/premium-expiry.service";
import { RegistrationCleanupService } from "./services/registration-cleanup.service";

import { NotificationModule } from "../notification/notification.module";

import { StreamEntity } from "../stream/models/streams/stream.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      ResetPasswordTokenEntity,
      RoleEntity,
      PermissionEntity,
      AccountRoleEntity,
      RolePermissionEntity,
      AccountPermissionEntity,
      SessionEntity,
      OtpEntity,
      StreamEntity,
    ]),
    PassportModule,
    NotificationModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AuthController,
    AccountsController,
    RolesController,
    PermissionsController,
  ],
  providers: [
    AccountRepository,
    AccountQuery,
    AccountCommands,
    RoleRepository,
    RoleCommands,
    RoleQueries,
    PermissionRepository,
    PermissionQueries,
    PermissionCommands,
    JwtStrategy,
    AuthService,
    AuthFlowService,
    OtpService,
    SessionRepository,
    SessionCommands,
    SessionQuery,
    PremiumExpiryService,
    RegistrationCleanupService,
  ],
  exports: [AccountCommands],
})
export class AccountModule { }
