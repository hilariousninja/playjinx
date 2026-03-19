import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid credentials');
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage('Account created! You can now sign in.');
    setMode('login');
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage('Check your email for a password reset link.');
    setLoading(false);
  };

  const onSubmit = mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset;
  const title = mode === 'login' ? 'Admin Login' : mode === 'signup' ? 'Create Account' : 'Reset Password';
  const buttonLabel = mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-bold text-center tracking-tight">{title}</h1>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        {message && <p className="text-sm text-primary text-center">{message}</p>}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="rounded-xl"
        />
        {mode !== 'reset' && (
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="rounded-xl"
          />
        )}
        <Button type="submit" className="w-full rounded-xl" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {buttonLabel}
        </Button>

        <div className="flex flex-col items-center gap-1.5 pt-1">
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Don't have an account? <span className="font-semibold">Sign up</span>
              </button>
              <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to login
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
