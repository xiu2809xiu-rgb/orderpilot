// DRAFT for the team to agree in Week 3, with the order contract.
//
// Domain event names, as `subject.verb`. Order status changes are area 2's and
// are added by its stories, not here.

import { z } from "zod";

export const EVENT_NAMES = [
  "document.received",
  "document.classified",
  "document.extracted",
  "document.confirmed",
  "order.created",
  "order.updated",
  "order.synced",
  "spr.drafted",
  "spr.submitted",
  "spr.approved",
  "spr.rejected",
  "pi.drafted",
  "pi.sent",
  "payment.confirmed",
  "payment.holdRaised",
  "payment.holdCleared",
  "shipment.updated",
  "exception.raised",
  "exception.resolved",
] as const;
export const eventNameSchema = z.enum(EVENT_NAMES);
export type EventName = z.infer<typeof eventNameSchema>;

/** The wrapper every event travels in. `idempotencyKey` lets a consumer drop a repeat. */
export const domainEventSchema = z.object({
  id: z.uuid(),
  name: eventNameSchema,
  occurredAt: z.iso.datetime(),
  idempotencyKey: z.string().min(1),
  traceId: z.string().min(1),
  // What it is about, for example { type: "order", id: "..." }.
  subject: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  actorUserId: z.uuid().nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type DomainEvent = z.infer<typeof domainEventSchema>;
