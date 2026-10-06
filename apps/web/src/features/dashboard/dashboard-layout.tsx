import { useTranslations } from 'next-intl';

export function widgetLabel(t: ReturnType<typeof useTranslations<'dashboard'>>, key: string): string {
  switch (key) {
    case 'contacts.active':
      return t('kpi.contactsActive');
    case 'contacts.new':
      return t('kpi.contactsNew');
    case 'reservations.today':
      return t('kpi.reservationsToday');
    case 'reservations.attention':
      return t('kpi.attention');
    case 'work.contacts':
      return t('workContacts');
    case 'work.reservations':
      return t('workReservations');
    case 'reservations.summary':
      return t('reservations');
    case 'activity':
      return t('activity');
    case 'analytics':
      return t('analytics');
    default:
      return key;
  }
}

export function kindLabel(t: ReturnType<typeof useTranslations<'dashboard'>>, kind: string): string {
  switch (kind) {
    case 'contact.created':
      return t('kinds.contactCreated');
    case 'contact.updated':
      return t('kinds.contactUpdated');
    case 'contact.archived':
      return t('kinds.contactArchived');
    case 'reservation.created':
      return t('kinds.reservationCreated');
    case 'reservation.cancelled':
      return t('kinds.reservationCancelled');
    case 'reservation.no_show':
      return t('kinds.reservationNoShow');
    case 'invitation.accepted':
      return t('kinds.invitationAccepted');
    default:
      return kind;
  }
}

export function formatWhen(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
