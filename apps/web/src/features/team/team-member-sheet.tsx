'use client';

import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

import { SheetChrome, SheetFrame, sheetStyles } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';
import { updateJobTitle, type TeamMember } from './team-api';
import { teamAvatarColor, teamInitials } from './team-member-card';
import styles from './team.module.css';

export function TeamMemberSheet({
  member,
  isSelf,
  canEditProfession,
  onClose,
  onMessage,
  onProfession,
}: {
  member: TeamMember;
  isSelf: boolean;
  canEditProfession: boolean;
  onClose: () => void;
  onMessage: (member: TeamMember) => void;
  onProfession: (member: TeamMember) => void;
}): ReactElement {
  const t = useTranslations('team');
  const job = useJobTitle(member);
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('memberInfo')} closeLabel={t('close')}>
        <SheetChrome
          as={canEditProfession ? 'form' : 'div'}
          title={member.name}
          onSubmit={(event) => void saveJob(event, member.id, job.value, job, onProfession)}
          footer={
            <SheetActions
              isSelf={isSelf}
              canEditProfession={canEditProfession}
              pending={job.pending}
              onMessage={() => onMessage(member)}
            />
          }
        >
          <MemberSummary member={member} />
          {canEditProfession ? (
            <label>
              {t('profession')}
              <input
                value={job.value}
                maxLength={80}
                onChange={(event) => job.setValue(event.target.value)}
              />
            </label>
          ) : (
            <p className={styles.sheetProfession}>{member.jobTitle ?? t('profession')}</p>
          )}
          {job.failed ? <span className={styles.failed}>{t('professionFailed')}</span> : null}
        </SheetChrome>
      </SheetFrame>
    </OverlayPortal>
  );
}

function SheetActions({
  isSelf,
  canEditProfession,
  pending,
  onMessage,
}: {
  isSelf: boolean;
  canEditProfession: boolean;
  pending: boolean;
  onMessage: () => void;
}): ReactElement {
  const t = useTranslations('team');
  return (
    <>
      {canEditProfession ? (
        <button type="submit" className={sheetStyles.save} disabled={pending}>
          {t('saveProfession')}
        </button>
      ) : null}
      {isSelf ? null : (
        <button type="button" className={sheetStyles.save} onClick={onMessage}>
          {t('emailAction')}
        </button>
      )}
    </>
  );
}

function MemberSummary({ member }: { member: TeamMember }): ReactElement {
  const t = useTranslations('team');
  const roles = useTranslations('contacts');
  return (
    <div className={styles.sheetSummary}>
      <span className={styles.sheetAvatar} style={{ background: teamAvatarColor(member.id) }}>
        {teamInitials(member.name)}
      </span>
      <dl className={styles.sheetFacts}>
        <div>
          <dt>{t('email')}</dt>
          <dd>{member.email}</dd>
        </div>
        <div>
          <dt>{t('role')}</dt>
          <dd>{roles(`role.${member.role}`)}</dd>
        </div>
      </dl>
    </div>
  );
}

function useJobTitle(member: TeamMember): {
  value: string;
  pending: boolean;
  failed: boolean;
  setValue: (value: string) => void;
  setPending: (value: boolean) => void;
  setFailed: (value: boolean) => void;
} {
  const [value, setValue] = useState(member.jobTitle ?? '');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setValue(member.jobTitle ?? '');
  }, [member.id, member.jobTitle]);
  return { value, pending, failed, setValue, setPending, setFailed };
}

async function saveJob(
  event: FormEvent<HTMLFormElement>,
  memberId: string,
  value: string,
  job: { setPending: (value: boolean) => void; setFailed: (value: boolean) => void },
  onSaved: (member: TeamMember) => void,
): Promise<void> {
  event.preventDefault();
  job.setPending(true);
  job.setFailed(false);
  try {
    onSaved(await updateJobTitle(memberId, value.trim() === '' ? null : value.trim()));
  } catch {
    job.setFailed(true);
  } finally {
    job.setPending(false);
  }
}
