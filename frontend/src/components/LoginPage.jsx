import React, { useState } from 'react';

const VALID_USERNAME = 'strongAdmin';
const VALID_PASSWORD = 'strongAdminpass_123';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Small artificial delay for polish
    await new Promise((r) => setTimeout(r, 600));

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      onLogin();
    } else {
      setLoading(false);
      setError('Invalid username or password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="login-page">
      {/* Background decorative blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className={`login-card ${shake ? 'login-card--shake' : ''}`}>
        {/* Logo / Branding */}
        <div className="login-brand">
          <img src="/cpp-log.png" alt="Compliance Professionals PLC" className="login-logo" />
          <div className="login-brand-divider" />
          <div>
            <div className="login-brand-title">Birthday Card Generator</div>
            <div className="login-brand-sub">Compliance Professionals PLC</div>
          </div>
        </div>

        <div className="login-heading">
          <h1 className="login-title">Admin Sign In</h1>
          <p className="login-subtitle">Enter your credentials to access the dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">Username</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">Password</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-input--padded-right"
                placeholder="Enter password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            id="login-submit-btn"
            className="login-submit"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <>
                <span className="btn-spinner" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <span className="login-lock-icon">🔒</span>
          Secure admin access only
        </div>
      </div>
    </div>
  );
}
