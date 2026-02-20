-- CreateEnum
CREATE TYPE "BookingHoldStatus" AS ENUM ('active', 'converted', 'expired', 'released');

-- CreateTable
CREATE TABLE "BookingHold" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "bookingRequestId" TEXT,
    "paymentReference" TEXT,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingHoldStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingHold_bookingRequestId_key" ON "BookingHold"("bookingRequestId");

-- CreateIndex
CREATE INDEX "BookingHold_roomTypeId_status_expiresAt_idx" ON "BookingHold"("roomTypeId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingHold_roomId_status_expiresAt_idx" ON "BookingHold"("roomId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingHold_arrivalDate_departureDate_idx" ON "BookingHold"("arrivalDate", "departureDate");

-- CreateIndex
CREATE INDEX "BookingHold_paymentReference_idx" ON "BookingHold"("paymentReference");

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
