import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';

interface Props {
    onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        // TODO: implement real Google OAuth flow with backend
        setTimeout(() => {
            setLoading(false);
            onLogin();
        }, 1500);
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-mesh)' }}>
            <GlassPanel variant="strong" style={{ width: 400, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 32, letterSpacing: 6, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', marginBottom: 8 }}>VIBE</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Agent-first IDE</div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{ width: '100%', padding: '12px 20px', background: loading ? 'rgba(0,0,0,0.05)' : '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                    >
                        {loading ? (
                            <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                                <path fill="#FBBC05" d="M4.5 10.51a4.8 4.8 0 010-3.02V5.42H1.83a8 8 0 000 7.16l2.67-2.07z"/>
                                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.42L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
                            </svg>
                        )}
                        {loading ? 'Signing in…' : 'Continue with Google'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                        By continuing you agree to the Terms of Service
                    </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16, width: '100%' }}>
                    VIBE v0.1.0 · Made by Muhammad Saeed
                </div>
            </GlassPanel>
        </div>
    );
}
