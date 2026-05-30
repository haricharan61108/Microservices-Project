-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "summaryError" TEXT,
ADD COLUMN     "summaryStatus" "SummaryStatus" NOT NULL DEFAULT 'PENDING';
