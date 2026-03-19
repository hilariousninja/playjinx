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
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid credentials');
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-bold text-center tracking-tight">Admin Login</h1>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="rounded-xl"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="rounded-xl"
        />
        <Button type="submit" className="w-full rounded-xl" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Sign In
        </Button>
      </form>
    </div>
  );
}
