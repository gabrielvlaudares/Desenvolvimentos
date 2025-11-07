-- AlterTable
ALTER TABLE "LocalUser" ADD COLUMN     "gestorId" INTEGER;

-- AddForeignKey
ALTER TABLE "LocalUser" ADD CONSTRAINT "LocalUser_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "LocalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
