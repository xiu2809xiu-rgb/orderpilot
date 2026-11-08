-- CreateEnum
CREATE TYPE "OrderCaptureState" AS ENUM ('DRAFT', 'SUBMITTED', 'VOID');

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" UUID NOT NULL,
    "orderNo" TEXT NOT NULL,
    "navisionNo" TEXT,
    "captureState" "OrderCaptureState" NOT NULL DEFAULT 'DRAFT',
    "customerNo" TEXT NOT NULL,
    "externalDocumentNo" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "shipmentDate" DATE,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "prepaymentPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "qtyToShip" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");

-- CreateIndex
CREATE INDEX "SalesOrder_customerNo_externalDocumentNo_idx" ON "SalesOrder"("customerNo", "externalDocumentNo");

-- CreateIndex
CREATE INDEX "SalesOrderLine_itemNo_idx" ON "SalesOrderLine"("itemNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_orderId_lineNo_key" ON "SalesOrderLine"("orderId", "lineNo");

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
