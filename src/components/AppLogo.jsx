import React from "react";

export default function AppLogo({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="hsl(173, 70%, 35%)" />
      {/* Medical cross */}
      <rect x="16" y="8" width="8" height="24" rx="1.5" fill="white" />
      <rect x="8" y="16" width="24" height="8" rx="1.5" fill="white" />
      {/* Small accent dot */}
      <circle cx="20" cy="20" r="3" fill="hsl(173, 70%, 35%)" />
    </svg>
  );
}