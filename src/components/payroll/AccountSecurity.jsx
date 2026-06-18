import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Mail, Loader2, Check, Shield, AlertCircle, Trash2, ExternalLink } from 'lucide-react';

export default function AccountSecurity() {
  const { user } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);

  if (!user) return null;

  const handleResetPassword = async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      await base44.auth.resetPasswordRequest(user.email);
      setResetSent(true);
    } catch (e) {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-base font-display font-semibold text-foreground">Account Security</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your password and connected accounts.
        </p>
      </div>

      {/* Password */}
      <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Change Password</p>
            <p className="text-xs text-muted-foreground">
              You'll receive an email with a secure link to reset your password.
            </p>
          </div>
        </div>

        {resetError && (
          <div className="text-xs px-3 py-2 rounded-lg bg-destructive/15 text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {resetError}
          </div>
        )}

        {resetSent ? (
          <div className="flex items-center gap-2 text-xs text-chart-4 bg-chart-4/10 rounded-lg px-3 py-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Reset link sent to <strong>{user.email}</strong>. Check your inbox (and spam folder).</span>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="text-xs"
          >
            {resetLoading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
            ) : (
              <><Mail className="w-3.5 h-3.5 mr-1.5" /> Send Password Reset Email</>
            )}
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground/70">
          If you signed up with Google or Apple, your password is managed by those providers.
        </p>
      </div>

      {/* Connected Providers */}
      <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Connected Accounts</p>
            <p className="text-xs text-muted-foreground">
              Sign-in providers linked to your account.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Google */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-sm text-foreground">Google</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Available</span>
          </div>

          {/* Apple */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-foreground" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.28 3.51 7.08 9.98 6.7c1.6.08 2.72.9 3.65.9.93 0 2.38-.9 3.96-.76 1.68.14 2.94.8 3.77 1.98-3.38 2.01-2.69 6.43.54 7.68-.65 1.7-1.49 3.4-2.85 3.78zM12.03 6.58c-.15-2.23 1.66-4.06 3.74-4.26.29 2.58-2.34 4.5-3.74 4.26z"/>
              </svg>
              <span className="text-sm text-foreground">Apple</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Available</span>
          </div>

          {/* Email/Password */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground">Email &amp; Password</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Danger Zone — Delete Account */}
      <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Delete Account</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Account deletion is managed through your Base44 account settings. You&apos;ll have a 7-day grace period to cancel if you change your mind.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="text-xs"
          onClick={() => window.open('https://base44.com/account-settings', '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          Open Account Settings
        </Button>
      </div>
    </section>
  );
}