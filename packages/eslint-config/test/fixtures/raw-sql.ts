// Known faults: SQL built from strings. The config must refuse both calls.

interface Db {
  $queryRawUnsafe(sql: string): Promise<unknown>;
  $executeRawUnsafe(sql: string): Promise<number>;
}

export async function removeUser(db: Db, id: string): Promise<void> {
  await db.$queryRawUnsafe(`SELECT * FROM "User" WHERE id = '${id}'`);
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${id}'`);
}
