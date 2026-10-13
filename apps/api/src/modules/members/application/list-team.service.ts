import { Injectable } from '@nestjs/common';

import type { RequestContext } from '../../../common/tenant/request-context';
import {
  MemberInvitationRepository,
  type InvitationListItem,
  type TenantMemberItem,
} from '../infrastructure/member-invitation.repository';

export type TeamSnapshot = {
  members: TenantMemberItem[];
  invitations: InvitationListItem[];
};

/** Active users and open invitations for the caller's tenant. */
@Injectable()
export class ListTeamService {
  constructor(private readonly invitations: MemberInvitationRepository) {}

  async list(context: RequestContext): Promise<TeamSnapshot> {
    const [members, invitations] = await Promise.all([
      this.invitations.listMembers(context.tenantId),
      this.invitations.listPending(context.tenantId, new Date()),
    ]);
    return { members, invitations };
  }
}
