import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AdminNav() {
  const navigate = useNavigate();
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <Button asChild variant="secondary" size="sm"><Link to="/test-api">Test API</Link></Button>
      <Button asChild variant="secondary" size="sm"><Link to="/admin/prix">Prix de vente</Link></Button>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Déconnexion</Button>
    </div>
  );
}
