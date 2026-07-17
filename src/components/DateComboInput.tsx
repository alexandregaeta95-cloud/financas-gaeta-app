import React from 'react';
import { Calendar } from 'lucide-react';

interface DateComboInputProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function DateComboInput({ value, onChange, required = false, className = "" }: DateComboInputProps) {
  return (
    <div className="relative w-full flex items-center">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.preventDefault()}
        required={required}
        style={{ colorScheme: 'dark' }}
        className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer relative z-10 clickable-date-input ${className}`}
      />
      <Calendar className="absolute right-4 w-4 h-4 text-slate-400 pointer-events-none z-20 shrink-0" />
    </div>
  );
}
