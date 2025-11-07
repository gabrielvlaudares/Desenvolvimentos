-- CreateTable
CREATE TABLE "GestorSubstituto" (
    "id" SERIAL NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "gestorOriginalId" INTEGER NOT NULL,
    "gestorSubstitutoId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorUpn" TEXT NOT NULL,

    CONSTRAINT "GestorSubstituto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GestorSubstituto_gestorOriginalId_idx" ON "GestorSubstituto"("gestorOriginalId");

-- CreateIndex
CREATE INDEX "GestorSubstituto_dataInicio_dataFim_idx" ON "GestorSubstituto"("dataInicio", "dataFim");

-- AddForeignKey
ALTER TABLE "GestorSubstituto" ADD CONSTRAINT "GestorSubstituto_gestorOriginalId_fkey" FOREIGN KEY ("gestorOriginalId") REFERENCES "LocalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestorSubstituto" ADD CONSTRAINT "GestorSubstituto_gestorSubstitutoId_fkey" FOREIGN KEY ("gestorSubstitutoId") REFERENCES "LocalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
