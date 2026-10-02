import { Module } from '@nestjs/common';

import { readInvitationTokenKey } from './infrastructure/invitation-seal';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { IdentityModule } from '../identity';
import { AcceptInvitationService } from './application/accept-invitation.service';
import { INVITATION_TOKEN_KEY, InviteMemberService } from './application/invite-member.service';
import { ListTeamService } from './application/list-team.service';
import { ResendInvitationService } from './application/resend-invitation.service';
import { RevokeInvitationService } from './application/revoke-invitation.service';
import { MemberInvitationRepository } from './infrastructure/member-invitation.repository';
import { InvitationAcceptController } from './presentation/invitation-accept.controller';
import { MemberInvitationsController } from './presentation/member-invitations.controller';

@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule, AuditModule, IdentityModule],
  controllers: [MemberInvitationsController, InvitationAcceptController],
  providers: [
    { provide: INVITATION_TOKEN_KEY, useFactory: () => readInvitationTokenKey() },
    MemberInvitationRepository,
    InviteMemberService,
    ResendInvitationService,
    RevokeInvitationService,
    AcceptInvitationService,
    ListTeamService,
  ],
})
export class MembersModule {}
