import { Inject, Injectable } from "@nestjs/common";
import type { RecordType } from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/** The running number behind OrderPilot's own record numbers: one counter per type and day. */
@Injectable()
export class RecordNumberRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Takes the next number for a type on a day. One atomic upsert: the row is
   * created at 1 or incremented in the same statement, so two requests at the
   * same moment can never be handed the same number.
   */
  async take(type: RecordType, day: string): Promise<number> {
    const row = await this.database.client.recordCounter.upsert({
      where: { recordType_day: { recordType: type, day } },
      create: { recordType: type, day, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });
    return row.lastValue;
  }
}
