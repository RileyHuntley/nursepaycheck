import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function NotificationSettings({ settings, setSettings }) {
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const sendTest = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      await base44.functions.invoke('sendPayPeriodNotification', {
        settings_id: settings.id,
        test_mode: true,
      });
      setTestResult({ type: 'success', text: 'Test email sent! Check your inbox.' });
      setTimeout(() => setTestResult(null), 4000);
    } catch (e) {
      setTestResult({ type: 'error', text: 'Failed to send test email. Verify your email address.' });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Get an email when a pay period ends and your shifts are ready for verification.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={settings.notification_enabled || false}
          onCheckedChange={(v) => setSettings('notification_enabled', v)}
        />
        <div>
          <Label className="text-xs text-foreground cursor-pointer">Enable verification reminders</Label>
          <p className="text-[10px] text-muted-foreground">
            Sends an email after a pay period's end date when it contains shifts needing verification.
          </p>
        </div>
      </div>

      {(settings.notification_enabled) && (
        <div className="space-y-3 pl-9">
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Notification Email</Label>
            <Input
              type="email"
              value={settings.notification_email || ''}
              onChange={(e) => setSettings('notification_email', e.target.value)}
              placeholder="you@example.com"
              className="h-8 text-sm max-w-xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTest}
              disabled={testSending || !settings.notification_email}
              className="text-xs h-7"
            >
              {testSending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
              Send Test
            </Button>
            {testResult && (
              <span className={`text-xs ${testResult.type === 'success' ? 'text-chart-4' : 'text-destructive'}`}>
                {testResult.text}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}