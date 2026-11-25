-- One bank transfer is confirmed once on an order: the same type under the same
-- reference is refused, even when two confirmations race in from two containers.
-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfirmation_orderRef_paymentType_reference_key" ON "PaymentConfirmation"("orderRef", "paymentType", "reference");
