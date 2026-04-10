import { useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import AdminPage from './pages/AdminPage';
import UserPage from './pages/UserPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/lib/api';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const CURRENT_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

function LoginPage() {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setAuthError(null);
    const googleToken = credentialResponse.credential;

    if (!googleToken) {
      const message = 'Google login did not return a credential token.';
      console.error(message);
      setAuthError(message);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Auth failed:', err);
        setAuthError(err?.error || 'Authentication failed on the server.');
        return;
      }

      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      console.error('Network error during login:', err);
      setAuthError('Network error during login. Make sure backend is running on port 5000.');
    }
  };

  if (!CLIENT_ID) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Google Login Not Configured</CardTitle>
              <CardDescription>
                Set VITE_GOOGLE_CLIENT_ID in frontend/.env to enable sign-in.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider
      clientId={CLIENT_ID}
      onScriptLoadError={() =>
        setAuthError(
          'Failed to load Google OAuth script. Check your internet connection and browser extensions that block third-party scripts.'
        )
      }
    >
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo / Brand */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img
                src="/silver-oak-logo.svg"
                alt="Silver Oak University"
                className="h-14 w-auto max-w-[240px]"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Event Management System</h1>
              <p className="text-muted-foreground text-sm">Manage and discover campus events</p>
            </div>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">Sign in with your Google account to continue</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  const message =
                    'Google blocked sign-in for this origin. Add this exact origin in Google Cloud Console > OAuth Client > Authorized JavaScript origins.';
                  console.error(message);
                  setAuthError(message);
                }}
                theme="outline"
                size="large"
                shape="rectangular"
                text="signin_with"
              />
            </CardContent>
          </Card>

          {authError ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Google Sign-In Error</CardTitle>
                <CardDescription>{authError}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>Current origin: {CURRENT_ORIGIN || 'unknown'}</p>
                <p>Configured client id: {CLIENT_ID || 'missing'}</p>
                <p>Add the origin above to Google Cloud Console and restart frontend after env changes.</p>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our terms of service
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/user" element={<UserPage />} />
      </Routes>
    </BrowserRouter>
  );
}
