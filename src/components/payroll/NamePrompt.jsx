import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Loader2 } from 'lucide-react';

export default function NamePrompt({ onDone }) {
  const { updateUserLocal } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.functions.invoke('updateUserName', { full_name: trimmed });
      updateUserLocal({ full_name: trimmed });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save name.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-display font-semibold text-foreground">Welcome to NursePayCheck</h2>
          <p className="text-sm text-muted-foreground mt-1">Please enter your full name to continue.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
              className="h-11"
            />
          </div>
          <Button type="submit" className="w-full h-11 font-medium" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}