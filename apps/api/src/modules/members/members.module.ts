import { Module } from '@nestjs/common';

import { readInvitationTokenKey } from './infrastructure/invitation-seal';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { IdentityModule } from '../identity';
import { AcceptInvitationService } from './application/accept-invitation.service';
import { DirectMessageService } from './application/direct-message.service';
import { MembersDashboardProjection } from './application/members-dashboard.projection';
import { INVITATION_TOKEN_KEY, InviteMemberService } from './application/invite-member.service';
import { ListTeamService } from './application/list-team.service';
import { TeamDirectoryService } from './application/team-directory.service';
import { ResendInvitationService } from './application/resend-invitation.service';
import { RevokeInvitationService } from './application/revoke-invitation.service';
import { InvitationAccessCookie, invitationAccessCookie } from './infrastructure/invitation-access-cookie';
import { MemberInvitationRepository } from './infrastructure/member-invitation.repository';
import { InvitationAcceptController } from './presentation/invitation-accept.controller';
import { MemberInvitationsController } from './presentation/member-invitations.controller';
import { TeamController } from './presentation/team.controller';

@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule, AuditModule, IdentityModule],
  controllers: [MemberInvitationsController, InvitationAcceptController, TeamController],
  providers: [
    { provide: INVITATION_TOKEN_KEY, useFactory: () => readInvitationTokenKey() },
    { provide: InvitationAccessCookie, useFactory: invitationAccessCookie },
    MemberInvitationRepository,
    InviteMemberService,
    ResendInvitationService,
    RevokeInvitationService,
    AcceptInvitationService,
    ListTeamService,
    TeamDirectoryService,
    DirectMessageService,
    MembersDashboardProjection,
  ],
  exports: [MembersDashboardProjection],
})
export class MembersModule {}
