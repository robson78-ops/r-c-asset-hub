REVOKE ALL ON FUNCTION public.audit_ticket_changes() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.compute_ticket_sla() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;