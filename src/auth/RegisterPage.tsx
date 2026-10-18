import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim(), group_code: code.trim() } },
    });
    setPending(false);
    if (err) {
      setError(/invalid group code|Database error saving new user/i.test(err.message) ? 'Ongeldige groepscode' : err.message);
      return;
    }
    if (!data?.session) {
      setError('Bevestig je e-mailadres via de link in je mail en log daarna in.');
      return;
    }
    navigate('/kaart');
  }

  return (
    <section className="page">
      <h1>Account maken</h1>
      <p className="muted">Bad Gastein · 28 feb – 6 mrt 2027</p>
      <form onSubmit={submit}>
        <label className="field">Naam<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="nickname" /></label>
        <label className="field">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label className="field">Wachtwoord<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
        <label className="field">Groepscode<input value={code} onChange={(e) => setCode(e.target.value)} required autoCapitalize="off" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={pending}>Account maken</button>
      </form>
      <p className="muted">Al een account? <Link to="/login">Inloggen</Link></p>
    </section>
  );
}
