import { usePrivacyMode } from '@/contexts/PrivacyModeContext';
import { formatCurrency } from '@/lib/utils';

export default function PrivacyAmount({ value, className }) {
  const { privacyMode } = usePrivacyMode();
  if (privacyMode) {
    return <span className={className} aria-label="hidden amount">••••••</span>;
  }
  return <span className={className}>{formatCurrency(value)}</span>;
}
