import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (err) {
      setError('Inloggen mislukt. Klopt je e-mail en wachtwoord?');
      return;
    }
    navigate('/kaart');
  }

  return (
    <section className="page">
      <h1>Inloggen</h1>
      <form onSubmit={submit}>
        <label className="field">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label className="field">Wachtwoord<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={pending}>Inloggen</button>
      </form>
      <p className="muted">Nog geen account? <Link to="/registreer">Account maken</Link></p>
    </section>
  );
}
