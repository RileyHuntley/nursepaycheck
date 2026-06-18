import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import { useBlocker } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, X, AlertTriangle, Link2, Copy, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SHARE_BASE_URL = 'https://nursepaycheck.ca';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedRef = useRef(null);

  const isDirty = useMemo(() => {
    if (!settings || !savedRef.current) return false;
    return !isEqual(settings, savedRef.current);
  }, [settings, savedVersion]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.Settings.list();
    if (list.length > 0) {
      setSettings(list[0]);
      savedRef.current = cloneDeep(list[0]);
    } else {
      const created = await base44.entities.Settings.create({
        share_show_pay_info: false,
        share_token: '',
      });
      setSettings(created);
      savedRef.current = cloneDeep(created);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const set = (path, value) => {
    setSettings(s => {
      const copy = { ...s };
      const keys = path.split('.');
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] = { ...obj[keys[i]] };
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const [shareCopied, setShareCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const syncShareLink = async (token, userId, settingsData, payPeriodsData) => {
    const existing = await base44.entities.ShareLink.filter({ token });
    if (existing.length > 0) {
      await base44.entities.ShareLink.update(existing[0].id, { settings_data: settingsData, pay_periods_data: payPeriodsData });
    } else {
      await base44.entities.ShareLink.create({ token, user_id: userId, settings_data: settingsData, pay_periods_data: payPeriodsData });
    }
  };

  const saveShareToken = async (token) => {
    await base44.entities.Settings.update(settings.id, { share_token: token || '' });
    const updated = { ...settings, share_token: token || '' };
    savedRef.current = cloneDeep(updated);
    setSettings(updated);
    setSavedVersion(v => v + 1);
    if (token) {
      const currentUser = await base44.auth.me();
      const safeSettings = {
        user_name: currentUser?.full_name || 'Nurse',
        show_pay_info: settings.share_show_pay_info || false,
        hourly_wage: settings.hourly_wage, premium_rates: settings.premium_rates,
        ot_multipliers: settings.ot_multipliers, active_allowances: settings.active_allowances,
        allowance_rates: settings.allowance_rates, active_qualifications: settings.active_qualifications,
        qualification_rates: settings.qualification_rates, hospitals: settings.hospitals,
        units: settings.units, preset_times: settings.preset_times, tax_settings: settings.tax_settings,
      };
      const payPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
      const withShifts = payPeriods.filter(p => p.shifts && p.shifts.length > 0);
      await syncShareLink(token, settings.created_by_id, safeSettings, withShifts);
    } else {
      const existing = await base44.entities.ShareLink.filter({ token: settings.share_token });
      if (existing.length > 0) await base44.entities.ShareLink.delete(existing[0].id);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await base44.entities.Settings.update(settings.id, settings);
      savedRef.current = cloneDeep(settings);
      setSavedVersion(v => v + 1);
      setMessage({ type: 'success', text: 'Settings saved.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Share your shift calendar</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      {message && (
        <div className={`text-sm px-4 py-2 rounded-lg ${message.type === 'success' ? 'bg-chart-4/15 text-chart-4' : 'bg-destructive/15 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {/* Share Link */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Share Link</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a unique link to let anyone view your shift calendar and pay period summaries — no login required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.share_show_pay_info || false}
            onCheckedChange={(v) => set('share_show_pay_info', v)}
          />
          <div>
            <Label className="text-xs text-foreground cursor-pointer">Include pay information in shared view</Label>
            <p className="text-[10px] text-muted-foreground">When off, only the shift calendar is visible — no dollar amounts.</p>
          </div>
        </div>

        {settings.share_token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
              <code className="text-xs font-mono text-foreground flex-1 break-all select-all">
                {`${SHARE_BASE_URL}/share?token=${settings.share_token}`}
              </code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${SHARE_BASE_URL}/share?token=${settings.share_token}`); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} className="h-8 flex-shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1" />
                {shareCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={async () => { setGenerating(true); const newToken = crypto.randomUUID(); await saveShareToken(newToken); setGenerating(false); }} disabled={generating} className="text-xs">
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { await saveShareToken(''); }} className="text-xs text-destructive hover:text-destructive">
                <X className="w-3.5 h-3.5 mr-1" />
                Revoke Link
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Regenerating invalidates the old link. Revoking stops all anonymous access.</p>
          </div>
        ) : (
          <Button size="sm" onClick={async () => { setGenerating(true); const newToken = crypto.randomUUID(); await saveShareToken(newToken); setGenerating(false); }} disabled={generating} className="bg-primary text-primary-foreground">
            <Link2 className="w-4 h-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Share Link'}
          </Button>
        )}
      </section>

      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-card border border-chart-2/30 shadow-lg rounded-xl px-4 py-2.5 animate-in slide-in-from-right-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-chart-2 animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-chart-2">Unsaved changes</span>
        </div>
      )}

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-chart-2" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your settings. If you leave now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay on Page</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}