-- Add scenario and intent columns to existing sessions table
-- Run this if you've already run the original migration

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS scenario text,
ADD COLUMN IF NOT EXISTS intent text;

-- Success message
do $$
begin
  raise notice '✅ Added scenario and intent columns to sessions table!';
end $$;

