-- New submissions wait for an admin decision before providers can discover
-- them. Existing OPEN/HAS_OFFERS rows remain live.
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
