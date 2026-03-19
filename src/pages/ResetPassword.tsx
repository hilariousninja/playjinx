import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

type ResetPhase = 'checking' | 'ready' | 'invalid';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<ResetPhase>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);

    const rawError =
      hashParams.get('error_description') ??
      queryParams.get('error_description') ??
      hashParams.get('error') ??
      queryParams.get('error');

    const isRecoveryLink =
      hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery';

    if (rawError) {
      setError(decodeURIComponent(rawError));
      setPhase('invalid');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError('This reset link is invalid or expired. Please request a new one.');
      setPhase((current) => (current === 'checking' ? 'invalid' : current));
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (isRecoveryLink && !!session)) {
        window.clearTimeout(timeoutId);
        setPhase('ready');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isRecoveryLink) {
        window.clearTimeout(timeoutId);
        setPhase('ready');
        return;
      }

      if (!isRecoveryLink) {
        window.clearTimeout(timeoutId);
        setError('Open this page from the password reset link in your email.');
        setPhase('invalid');
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage('Password updated! Redirecting…');
    setTimeout(() => navigate('/dashboard'), 1500);
  };

  if (phase === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
        <div className="text-center space-y-2">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
        <div className="w-full max-w-sm space-y-4 p-6 text-center">
          <h1 className="font-display text-xl font-bold tracking-tight">Reset Link Issue</h1>
          <p className="text-sm text-destructive">{error || 'This reset link is invalid or expired.'}</p>
          <Button type="button" className="w-full rounded-xl" onClick={() => navigate('/admin-login')}>
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-bold text-center tracking-tight">Set New Password</h1>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        {message && <p className="text-sm text-primary text-center">{message}</p>}
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-xl"
        />
        <Button type="submit" className="w-full rounded-xl" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Update Password
        </Button>
      </form>
    </div>
  );
}
