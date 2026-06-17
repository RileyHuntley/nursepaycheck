import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/** Format a number as currency with thousands separators ($1,234.56) */
export function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}