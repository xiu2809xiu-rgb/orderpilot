import { Inject, Injectable } from "@nestjs/common";
import type { RecordNumber } from "@orderpilot/shared";
import { RecordNumberService } from "../workflows/record-number.service.js";

/**
 * Hands out the numbers of stored orders (`SO-20261108-0001`) from the record
 * number service. The counter joins the caller's transaction, so a rolled-back
 * order leaves no gap.
 */
@Injectable()
export class OrderNumberAllocator {
  constructor(
    @Inject(RecordNumberService) private readonly numbers: RecordNumberService,
  ) {}

  next(at: Date = new Date()): Promise<RecordNumber> {
    return this.numbers.next("SO", at);
  }
}
