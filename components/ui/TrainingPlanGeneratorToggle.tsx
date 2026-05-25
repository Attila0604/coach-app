'use client';

import { useState } from 'react';

export default function TrainingPlanGeneratorToggle({
  children,
  defaultOpen = false,
  label = '✨ Plan neu generieren',
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-[11px] uppercase tracking-caps font-medium px-5 py-3 border border-white/15 text-bone-muted hover:text-bone hover:border-white/30 transition flex items-center justify-between"
      >
        <span>{label}</span>
        <span className="text-bone-faint">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
