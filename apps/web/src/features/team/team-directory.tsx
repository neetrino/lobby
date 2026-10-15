'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { ContactsRequestError } from '../contacts/contacts-api';
import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { useSession } from '../contacts/use-contact-list';
import { readTeamDirectory, type TeamDirectory, type TeamMember } from './team-api';
import { AddMemberButton } from './team-add-member';
import { Pagination } from '../../ui/pagination/pagination';
import { SearchFilters } from '../../ui/search-filters/search-filters';
import { TeamChat } from './team-chat';
import { TeamMemberCard } from './team-member-card';
import styles from './team.module.css';

const PAGE_SIZE = 9;

export function TeamDirectoryPage() {
  const t = useTranslations('team');
  const locale = useLocale();
  const router = useRouter();
  const { session, error } = useSession();
  const { directory, failed, setDirectory } = useTeamDirectory();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [openMember, setOpenMember] = useState<TeamMember | null>(null);
  const canEdit = session?.user.role === 'OWNER' || session?.user.role === 'ADMIN';
  const visible = pageOf(directory?.members ?? [], query, page);

  useEffect(() => {
    if (isSignedOut(error)) {
      router.replace(`/${locale}/login`);
    }
  }, [error, locale, router]);

  return (
    <div className={shell.app}>
      <ContactsShell session={session} current="team" />
      <main className={`${shell.main} ${styles.canvas}`}>
        <div className={styles.workspace}>
          <section className={styles.board}>
            <h1>{t('title')}</h1>
            <div className={styles.toolbar}>
              <SearchFilters
                white
                value={query}
                placeholder={t('search')}
                label={t('search')}
                onChange={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
              />
              {canEdit ? <AddMemberButton /> : null}
            </div>
            {failed ? <p className={styles.failed}>{t('failed')}</p> : null}
            {visible.rows.length === 0 && directory !== null ? (
              <p className={styles.notice}>{t('empty')}</p>
            ) : null}
            <div className={styles.grid}>
              {visible.rows.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  isSelf={member.id === session?.user.id}
                  selected={member.id === openMember?.id}
                  canEditProfession={canEdit}
                  onMessage={setOpenMember}
                  onProfession={(saved) => replaceMember(setDirectory, setOpenMember, saved)}
                />
              ))}
            </div>
            <div className={styles.pager}>
              <Pagination
                page={visible.page + 1}
                pageCount={visible.pageCount}
                onPage={(next) => setPage(next - 1)}
              />
            </div>
          </section>
          {openMember === null ? null : (
            <TeamChat
              member={openMember}
              selfId={session?.user.id ?? null}
              onClose={() => setOpenMember(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function pageOf(
  members: TeamMember[],
  query: string,
  page: number,
): { rows: TeamMember[]; page: number; pageCount: number } {
  const needle = query.trim().toLowerCase();
  const filtered =
    needle.length === 0 ? members : members.filter((member) => matches(member, needle));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  return { rows: filtered.slice(start, start + PAGE_SIZE), page: safePage, pageCount };
}

function matches(member: TeamMember, needle: string): boolean {
  return [member.name, member.email, member.jobTitle ?? '', member.role]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

function useTeamDirectory(): {
  directory: TeamDirectory | null;
  failed: boolean;
  setDirectory: Dispatch<SetStateAction<TeamDirectory | null>>;
} {
  const [directory, setDirectory] = useState<TeamDirectory | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    readTeamDirectory(controller.signal).then(
      (next) => setDirectory(next),
      () => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      },
    );
    return () => controller.abort();
  }, []);
  return { directory, failed, setDirectory };
}

function replaceMember(
  setDirectory: Dispatch<SetStateAction<TeamDirectory | null>>,
  setOpenMember: Dispatch<SetStateAction<TeamMember | null>>,
  saved: TeamMember,
): void {
  setDirectory((current) => {
    if (current === null) {
      return current;
    }
    return {
      ...current,
      members: current.members.map((member) => (member.id === saved.id ? saved : member)),
    };
  });
  setOpenMember((current) => (current?.id === saved.id ? saved : current));
}

function isSignedOut(error: ContactsRequestError | null): boolean {
  return (
    error?.code === 'UNAUTHENTICATED' ||
    error?.code === 'SESSION_EXPIRED' ||
    error?.code === 'SESSION_REVOKED'
  );
}
