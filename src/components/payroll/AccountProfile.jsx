import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, User, Pencil, Check, X, Loader2 } from 'lucide-react';

export default function AccountProfile() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  if (!user) return null;

  const startEdit = () => {
    setName(user.full_name || '');
    setMessage(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setName('');
  };

  const saveName = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      setMessage({ type: 'success', text: 'Name updated.' });
      setEditing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update name.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-base font-display font-semibold text-foreground">Account Profile</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your account identity.
        </p>
      </div>

      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-chart-4/15 text-chart-4' : 'bg-destructive/15 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          {editing ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-8 text-sm flex-1"
                placeholder="Your name"
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={saveName} disabled={saving || !name.trim()} className="h-8 w-8 text-chart-4 hover:text-chart-4">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={cancelEdit} disabled={saving} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{user.full_name || 'No name set'}</p>
                <Button size="icon" variant="ghost" onClick={startEdit} className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Full Name</p>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">Registered Email</p>
          </div>
        </div>
      </div>
    </section>
  );
}