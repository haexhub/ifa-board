-- Extend the original invitation policy after invitations.player_id exists.
DROP POLICY invitations_write_trainer ON public.invitations;

CREATE POLICY invitations_write_trainer ON public.invitations
  FOR ALL TO authenticated
  USING (
    public.is_trainer(team_id)
    AND (
      player_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.players p
        WHERE p.id = invitations.player_id
          AND p.team_id = invitations.team_id
      )
    )
  )
  WITH CHECK (
    public.is_trainer(team_id)
    AND (
      player_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.players p
        WHERE p.id = invitations.player_id
          AND p.team_id = invitations.team_id
      )
    )
  );
