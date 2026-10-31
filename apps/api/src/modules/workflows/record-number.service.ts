import { Inject, Injectable } from "@nestjs/common";
import {
  formatRecordNumber,
  recordDay,
  type RecordNumber,
  type RecordType,
} from "@orderpilot/shared";
import { RecordNumberRepository } from "./record-number.repository.js";

/**
 * Hands out OrderPilot's own record numbers (`SPR-20261102-0001`) with the
 * shared helper. Navision's number is a separate field on the record
 * (`navisionNo`), filled in once Navision has the record.
 */
@Injectable()
export class RecordNumberService {
  constructor(
    @Inject(RecordNumberRepository)
    private readonly counters: RecordNumberRepository,
  ) {}

  async next(type: RecordType, at: Date = new Date()): Promise<RecordNumber> {
    const sequence = await this.counters.take(type, recordDay(at));
    return formatRecordNumber(type, at, sequence);
  }
}
