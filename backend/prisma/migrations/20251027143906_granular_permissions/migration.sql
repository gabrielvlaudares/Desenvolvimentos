/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `PermissionGroup` table. All the data in the column will be lost.
  - You are about to drop the column `isManager` on the `PermissionGroup` table. All the data in the column will be lost.
  - You are about to drop the column `isPortaria` on the `PermissionGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PermissionGroup" DROP COLUMN "isAdmin",
DROP COLUMN "isManager",
DROP COLUMN "isPortaria",
ADD COLUMN     "can_access_admin_panel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_access_portaria_control" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_create_saida_maquina" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_create_transferencia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_config" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_groups" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_users" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_perform_approvals" BOOLEAN NOT NULL DEFAULT false;
