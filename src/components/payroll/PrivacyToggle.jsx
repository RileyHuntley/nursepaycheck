import { Eye, EyeOff } from 'lucide-react';
import { usePrivacyMode } from '@/contexts/PrivacyModeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function PrivacyToggle() {
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={togglePrivacyMode}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={privacyMode ? 'Untoggle privacy' : 'Toggle privacy'}
        >
          {privacyMode
            ? <EyeOff className="w-5 h-5" />
            : <Eye className="w-5 h-5" />
          }
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {privacyMode ? 'Untoggle privacy' : 'Toggle privacy'}
      </TooltipContent>
    </Tooltip>
  );
}
