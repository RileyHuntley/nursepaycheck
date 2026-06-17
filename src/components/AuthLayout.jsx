import React, { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import AppLogo from "@/components/AppLogo";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { resolvedTheme, setTheme } = useTheme();
  const prevThemeRef = useRef(null);

  useEffect(() => {
    prevThemeRef.current = resolvedTheme;
    setTheme("light");
    return () => {
      if (prevThemeRef.current && prevThemeRef.current !== "light") {
        setTheme(prevThemeRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(210,20%,98%)] px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <AppLogo className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold tracking-tight text-[hsl(220,16%,10%)]">
            Nurse<span className="text-[hsl(173,70%,35%)]">Pay</span>Check
          </h1>
          <p className="text-sm text-[hsl(215,15%,45%)] mt-1.5">
            NBA Collective Agreement payroll verification for BC nurses
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[hsl(210,15%,85%)] p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[hsl(173,70%,35%)] mb-3">
              <Icon className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[hsl(220,16%,10%)]">{title}</h2>
            {subtitle && <p className="text-sm text-[hsl(215,15%,45%)] mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-[hsl(215,15%,45%)] mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}