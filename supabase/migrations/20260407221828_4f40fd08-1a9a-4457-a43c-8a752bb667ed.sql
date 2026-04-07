
-- Groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My JINX group',
  invite_code TEXT NOT NULL UNIQUE,
  creator_session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups readable by everyone" ON public.groups FOR SELECT TO public USING (true);
CREATE POLICY "Groups insertable by everyone" ON public.groups FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Groups updatable by creator" ON public.groups FOR UPDATE TO public USING (true);

-- Group members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, session_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members readable by everyone" ON public.group_members FOR SELECT TO public USING (true);
CREATE POLICY "Group members insertable by everyone" ON public.group_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Group members updatable by everyone" ON public.group_members FOR UPDATE TO public USING (true);

-- Enable realtime for group_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
