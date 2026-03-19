import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'rajan.p@hotmail.co.uk';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const check = (email: string | undefined) => {
      if (!email) return 'unauthorized';
      return email.toLowerCase() === ADMIN_EMAIL ? 'authorized' : 'unauthorized';
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? check(session.user.email) : 'unauthorized');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? check(session.user.email) : 'unauthorized');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
}
