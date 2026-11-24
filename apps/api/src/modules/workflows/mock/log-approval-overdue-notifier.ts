import { Injectable, Logger } from "@nestjs/common";
import {
  ApprovalOverdueNotifier,
  type OverdueApproval,
} from "../domain/approval-overdue-notifier.js";

/**
 * The stand-in until P-100 sends the email: it logs that the approver group
 * would be emailed, by count, and sends nothing. The names stay out of the
 * log.
 */
@Injectable()
export class LogApprovalOverdueNotifier extends ApprovalOverdueNotifier {
  private readonly logger = new Logger(LogApprovalOverdueNotifier.name);

  notify(approval: OverdueApproval): Promise<void> {
    this.logger.log(
      {
        key: approval.key,
        orderRef: approval.orderRef,
        recordNo: approval.recordNo,
        approvers: approval.approvers.length,
      },
      "An SPR approval is 24 hours old; the approver group would be emailed (no mail sender yet)",
    );
    return Promise.resolve();
  }
}
