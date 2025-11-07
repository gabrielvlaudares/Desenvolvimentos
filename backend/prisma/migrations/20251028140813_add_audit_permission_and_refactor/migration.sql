/*
  Warnings:

  - You are about to drop the column `processoUuid` on the `ProcessoEvento` table. All the data in the column will be lost.
  - Added the required column `entityIdentifier` to the `ProcessoEvento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `ProcessoEvento` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ProcessoEvento" DROP CONSTRAINT "fk_evento_maquina";

-- DropForeignKey
ALTER TABLE "public"."ProcessoEvento" DROP CONSTRAINT "fk_evento_transferencia";

-- AlterTable
ALTER TABLE "PermissionGroup" ADD COLUMN     "can_view_audit_log" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProcessoEvento" DROP COLUMN "processoUuid",
ADD COLUMN     "entityIdentifier" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ProcessoEvento_timestamp_idx" ON "ProcessoEvento"("timestamp");

-- CreateIndex
CREATE INDEX "ProcessoEvento_usuarioUpn_idx" ON "ProcessoEvento"("usuarioUpn");

-- CreateIndex
CREATE INDEX "ProcessoEvento_entityType_entityIdentifier_idx" ON "ProcessoEvento"("entityType", "entityIdentifier");

-- AddForeignKey
ALTER TABLE "ProcessoEvento" ADD CONSTRAINT "fk_evento_maquina_optional" FOREIGN KEY ("entityIdentifier") REFERENCES "MaquinaSaida"("processoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoEvento" ADD CONSTRAINT "fk_evento_transferencia_optional" FOREIGN KEY ("entityIdentifier") REFERENCES "Transferencia"("processoId") ON DELETE RESTRICT ON UPDATE CASCADE;
