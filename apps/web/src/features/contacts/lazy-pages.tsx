'use client';

import { lazyWorkspace } from './lazy-workspace';

export const DashboardPage = lazyWorkspace(
  () => import('../dashboard/dashboard-workspace').then((mod) => mod.DashboardWorkspace),
  'dashboard',
);

export const LeadsPage = lazyWorkspace(
  () => import('../pipeline/pipeline-workspace').then((mod) => mod.PipelineWorkspace),
  'leads',
);

export const DealsPage = lazyWorkspace(
  () => import('../pipeline/pipeline-workspace').then((mod) => mod.PipelineWorkspace),
  'deals',
);

export const ContactsPage = lazyWorkspace(
  () => import('./contacts-workspace').then((mod) => mod.ContactsWorkspace),
  'contacts',
);

export const TeamPage = lazyWorkspace(
  () => import('../team/team-directory').then((mod) => mod.TeamDirectoryPage),
  'team',
);

export const ReservationsPage = lazyWorkspace(
  () => import('../reservations/reservations-workspace').then((mod) => mod.ReservationsWorkspace),
  'reservations',
);

export const AuditPage = lazyWorkspace(
  () => import('../audit/audit-workspace').then((mod) => mod.AuditWorkspace),
  'audit',
);

export const SettingsPage = lazyWorkspace(
  () => import('../settings/workspace-settings').then((mod) => mod.WorkspaceSettings),
  'settings',
);
