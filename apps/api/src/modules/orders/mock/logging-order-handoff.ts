import { Injectable, Logger } from "@nestjs/common";
import {
  OrderHandoff,
  type HandoffAnswer,
  type OrderSubmitted,
  type PoVersionConfirmed,
} from "../domain/order-handoff.js";

const NOTHING: HandoffAnswer = { effect: "none" };

/**
 * The stand-in until area 2 binds its class under `OrderHandoff`: it changes
 * no status, answers `none`, and logs that it did nothing. The log line holds
 * the order number and the PO version number and no other order data, so no
 * total and no customer reaches a log through it.
 */
@Injectable()
export class LoggingOrderHandoff extends OrderHandoff {
  private readonly logger = new Logger(LoggingOrderHandoff.name);

  submitted(fact: OrderSubmitted): Promise<HandoffAnswer> {
    return this.standIn("submitted", fact.orderNo, fact.poVersionNo);
  }

  poVersionConfirmed(fact: PoVersionConfirmed): Promise<HandoffAnswer> {
    return this.standIn("poVersionConfirmed", fact.orderNo, fact.poVersionNo);
  }

  private standIn(
    call: string,
    orderNo: string,
    poVersionNo: number,
  ): Promise<HandoffAnswer> {
    this.logger.log(
      { call, orderNo, poVersionNo },
      "The order handoff is a stand-in: no workflow was told and nothing was changed",
    );
    return Promise.resolve(NOTHING);
  }
}
