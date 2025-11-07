-- CreateTable
CREATE TABLE "LocalUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPortaria" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "descricao" TEXT,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MaquinaSaida" (
    "id" SERIAL NOT NULL,
    "processoId" TEXT NOT NULL,
    "idSequencial" SERIAL NOT NULL,
    "tipoSaida" TEXT NOT NULL,
    "statusProcesso" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "areaResponsavel" TEXT NOT NULL,
    "criadoPorUpn" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gestorEmail" TEXT NOT NULL,
    "gestorAprovadorUpn" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "motivoRejeicao" TEXT,
    "descricaoMaterial" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivoSaida" TEXT NOT NULL,
    "dataEnvio" TIMESTAMP(3) NOT NULL,
    "prazoRetorno" TIMESTAMP(3),
    "dataSaidaEfetiva" TIMESTAMP(3),
    "dataRetornoEfetivo" TIMESTAMP(3),
    "portariaSaida" TEXT,
    "vigilanteSaidaUpn" TEXT,
    "nfSaida" TEXT,
    "pdfUrlSaida" TEXT,
    "nfRetorno" TEXT,
    "pdfUrlRetorno" TEXT,

    CONSTRAINT "MaquinaSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transferencia" (
    "id" SERIAL NOT NULL,
    "processoId" TEXT NOT NULL,
    "idSequencial" SERIAL NOT NULL,
    "statusProcesso" TEXT NOT NULL,
    "criadoPorUpn" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeRequisitante" TEXT NOT NULL,
    "dataSaidaSolicitada" TIMESTAMP(3) NOT NULL,
    "numeroNf" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "portariaSaida" TEXT NOT NULL,
    "portariaDestino" TEXT NOT NULL,
    "vigilanteSaidaUpn" TEXT,
    "dataSaidaEfetiva" TIMESTAMP(3),
    "decisaoSaida" TEXT,
    "obsSaida" TEXT,
    "vigilanteChegadaUpn" TEXT,
    "dataChegadaEfetiva" TIMESTAMP(3),
    "decisaoChegada" TEXT,
    "obsChegada" TEXT,

    CONSTRAINT "Transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessoEvento" (
    "id" SERIAL NOT NULL,
    "processoUuid" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuarioUpn" TEXT NOT NULL,
    "detalhes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalUser_username_key" ON "LocalUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "LocalUser_email_key" ON "LocalUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MaquinaSaida_processoId_key" ON "MaquinaSaida"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "MaquinaSaida_idSequencial_key" ON "MaquinaSaida"("idSequencial");

-- CreateIndex
CREATE UNIQUE INDEX "Transferencia_processoId_key" ON "Transferencia"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "Transferencia_idSequencial_key" ON "Transferencia"("idSequencial");

-- AddForeignKey
ALTER TABLE "ProcessoEvento" ADD CONSTRAINT "fk_evento_maquina" FOREIGN KEY ("processoUuid") REFERENCES "MaquinaSaida"("processoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoEvento" ADD CONSTRAINT "fk_evento_transferencia" FOREIGN KEY ("processoUuid") REFERENCES "Transferencia"("processoId") ON DELETE RESTRICT ON UPDATE CASCADE;
