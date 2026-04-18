/*
  Warnings:

  - Made the column `password_salt` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_salt" SET NOT NULL;
