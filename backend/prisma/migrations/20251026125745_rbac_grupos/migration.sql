/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `LocalUser` table. All the data in the column will be lost.
  - You are about to drop the column `isManager` on the `LocalUser` table. All the data in the column will be lost.
  - You are about to drop the column `isPortaria` on the `LocalUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LocalUser" DROP COLUMN "isAdmin",
DROP COLUMN "isManager",
DROP COLUMN "isPortaria",
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PermissionGroup" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPortaria" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupLink" (
    "usuarioId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,

    CONSTRAINT "UserGroupLink_pkey" PRIMARY KEY ("usuarioId","grupoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_nome_key" ON "PermissionGroup"("nome");

-- AddForeignKey
ALTER TABLE "UserGroupLink" ADD CONSTRAINT "UserGroupLink_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "LocalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupLink" ADD CONSTRAINT "UserGroupLink_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
