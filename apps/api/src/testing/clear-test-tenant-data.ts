import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

/**
 * Removes tenant-owned rows in foreign-key order.
 * Add a new tenant table here, before the rows it references.
 */
export async function clearTestTenantData(database: PrismaClient | undefined): Promise<void> {
  if (!database) {
    return;
  }
  await database.reservationStatusHistory.deleteMany();
  await database.reservationTable.deleteMany();
  await database.reservation.deleteMany();
  await database.servicePeriod.deleteMany();
  await database.restaurantTable.deleteMany();
  await database.diningArea.deleteMany();
  await database.venue.deleteMany();
  await database.pipelineCard.deleteMany();
  await database.pipelineColumn.deleteMany();
  await database.pipeline.deleteMany();
  await database.contact.deleteMany();
  await database.outboxEvent.deleteMany();
  await database.auditEvent.deleteMany();
  await database.memberInvitation.deleteMany();
  await database.passwordReset.deleteMany();
  await database.userDashboardLayout.deleteMany();
  await database.tenantModule.deleteMany();
  await database.user.deleteMany();
  await database.tenant.deleteMany();
}
