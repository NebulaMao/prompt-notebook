-- Create a function to safely increment likes
-- This function can be called via supabase.rpc('increment_likes', { prompt_id: 'uuid' })

create or replace function increment_likes(p_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.prompts
  set likes = likes + 1
  where id = p_id;
end;
$$;
