-- Campaigns & Groups — Phase 2: lead lifecycle stages
-- Run in the Supabase SQL editor. Idempotent.
-- meeting + converted are manual-only stages above 'replied'.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block; the Supabase
-- SQL editor runs statements individually, so run these one at a time if needed.

alter type contact_status add value if not exists 'meeting';
alter type contact_status add value if not exists 'converted';
