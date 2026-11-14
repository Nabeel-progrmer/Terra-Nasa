import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/http.js';
import { translate } from '../i18n.js';
import './AccountPage.css';

const MODES = [
  { id: 'login', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
  { id: 'forgot', label: 'Reset password' },
];

export default function AccountPage({ locale = 'en-US' }) {
  const t = (source) => translate(locale, source);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('login');
  const [account, setAccount] = useState(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [actionToken, setActionToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verificationToken = params.get('verify');
    const resetToken = params.get('reset');
    if (verificationToken) {
      setMode('verify');
      setActionToken(verificationToken);
    } else if (resetToken) {
      setMode('reset');
      setActionToken(resetToken);
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Account status is unavailable.');
        if (active) {
          setAccount(data.user);
          queryClient.setQueryData(['account-session'], data);
        }
      })
      .catch((requestError) => { if (active) setAccountError(requestError.message); })
      .finally(() => { if (active) setCheckingAccount(false); });
    return () => { active = false; };
  }, [queryClient]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      let path;
      let payload;
      if (mode === 'verify') {
        path = '/api/auth/verify';
        payload = { token: actionToken };
      } else if (mode === 'forgot' || mode === 'resend') {
        path = mode === 'forgot' ? '/api/auth/password-reset/request' : '/api/auth/verification/resend';
        payload = { email };
      } else if (mode === 'reset') {
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        path = '/api/auth/password-reset/confirm';
        payload = { token: actionToken, password };
      } else {
        path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
        payload = { email, password };
      }
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'The account request could not be completed.');
      if (mode === 'login' || mode === 'verify') {
        setAccount(data.user);
        queryClient.setQueryData(['account-session'], { user: data.user });
      }
      setMessage(data.message || t(mode === 'verify' ? 'Email verified. You are signed in.' : 'Account request completed.'));
      setPassword('');
      setConfirmPassword('');
      if (mode === 'reset') {
        setMode('login');
        setActionToken('');
        navigate('/account', { replace: true });
      }
      if (mode === 'verify') {
        setActionToken('');
        navigate('/account', { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message || 'The account request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not end the account session.');
      setAccount(null);
      queryClient.setQueryData(['account-session'], { user: null });
      queryClient.removeQueries({ queryKey: ['account-learning-state'] });
      setMessage(t('You are signed out.'));
      navigate('/account', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Could not end the account session.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="page account-page">
    <header className="page-header"><p className="eyebrow">{t('Private workspace')}</p><h1>{t('Your TERRA account')}</h1><p>{t('Verified accounts keep research notes and Learning Center progress private to your account.')}</p></header>
    {accountError && <p className="account-error" role="alert">{t('Account service is unavailable. You can try again later.')}</p>}
    {checkingAccount ? <p role="status">{t('Checking your account session…')}</p> : account ? <section className="account-card">
      <h2>{t('Signed in')}</h2>
      <p><strong>{t('Email:')}</strong> {account.email}</p>
      <p><strong>{t('Email verified:')}</strong> {account.emailVerified ? t('Yes') : t('No')}</p>
      <p>{t('Your private notes and synced Learning Center progress are available on this account.')}</p>
      <div className="account-links"><Link to="/investigations">{t('Open private research notes')}</Link><Link to="/learn">{t('Open Learning Center')}</Link></div>
      <button type="button" className="secondary" onClick={signOut} disabled={busy}>{busy ? t('Signing out…') : t('Sign out')}</button>
    </section> : <>
      {mode !== 'verify' && mode !== 'reset' && mode !== 'resend' && <div className="account-mode-tabs" role="group" aria-label={t('Account action')}>
        {MODES.map((item) => <button key={item.id} type="button" className={mode === item.id ? 'selected' : ''} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setMessage(''); setError(''); }}>{t(item.label)}</button>)}
      </div>}
      <section className="account-card">
        {mode === 'verify' ? <><h2>{t('Verify your email address')}</h2><p>{t('Use the one-time link sent to your email. The link expires after 24 hours.')}</p><form onSubmit={submit}><button className="primary" type="submit" disabled={busy || !actionToken}>{busy ? t('Verifying…') : t('Verify email and sign in')}</button></form></>
          : mode === 'reset' ? <><h2>{t('Choose a new password')}</h2><p>{t('This one-time reset link expires after one hour.')}</p><form onSubmit={submit}>
            <label htmlFor="account-new-password">{t('New password')}<input id="account-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label htmlFor="account-confirm-password">{t('Confirm new password')}<input id="account-confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="primary" type="submit" disabled={busy}>{busy ? t('Updating…') : t('Update password')}</button>
          </form></>
            : mode === 'resend' ? <><h2>Resend verification email</h2><form onSubmit={submit}>
              <label htmlFor="resend-email">{t('Email address')}<input id="resend-email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? t('Sending…') : t('Send verification email')}</button>
              <button className="account-resend" type="button" onClick={() => setMode('login')}>{t('Back to sign in')}</button>
            </form></>
            : <><h2>{t(mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Request a password reset' : 'Sign in to TERRA')}</h2>
              <form onSubmit={submit}>
                <label htmlFor="account-email">{t('Email address')}<input id="account-email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                {(mode === 'login' || mode === 'register') && <label htmlFor="account-password">{t('Password')}<input id="account-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 12 : 1} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />{mode === 'register' && <small>{t('Use at least 12 characters. Passwords are stored as salted scrypt hashes.')}</small>}</label>}
                <button className="primary" type="submit" disabled={busy}>{busy ? t('Please wait…') : t(mode === 'register' ? 'Create account and send verification' : mode === 'forgot' ? 'Send reset link' : 'Sign in')}</button>
              </form>
              {mode === 'login' && <button className="account-resend" type="button" onClick={() => { setMode('resend'); setMessage(''); setError(''); }}>{t('Resend verification email')}</button>}
            </>}
        {message && <p className="account-message" role="status" aria-live="polite">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        <p className="account-privacy">{t("Account email and password are sent only to the TERRA API. Email delivery requires the server's SMTP configuration.")}</p>
      </section>
    </>}
  </main>;
}
