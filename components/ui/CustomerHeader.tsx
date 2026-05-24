import Link from 'next/link';
import { STATUS_LABELS } from '@/lib/coach-customer-helpers';

export default function CustomerHeader({
  customerId,
  displayName,
  status,
  backLabel = 'Übersicht',
}: {
  customerId: string;
  displayName: string;
  status: string;
  backLabel?: string;
}) {
  const styles: Record<string, string> = {
    active: 'border-gold/40 text-gold',
    intake: 'border-bone/30 text-bone',
    paused: 'border-bone-muted/30 text-bone-muted',
    archived: 'border-bone-faint text-bone-faint',
  };
  const style = styles[status] ?? styles.paused;
  const label = STATUS_LABELS[status] ?? status;

  return (
    <>
      <Link
        href={`/coach/customers/${customerId}`}
        className="text-[11px] uppercase tracking-caps text-bone-faint hover:text-bone-muted transition-colors mb-6 inline-flex items-center gap-2"
      >
        <span>←</span>
        <span>{backLabel}</span>
      </Link>
      <div className="flex items-center justify-between gap-4 mb-10 flex-wrap">
        <h1 className="font-serif text-2xl text-bone leading-tight">
          {displayName}
        </h1>
        <span
          className={`text-[10px] px-3 py-1.5 border ${style} tracking-caps uppercase font-medium`}
        >
          {label}
        </span>
      </div>
    </>
  );
}
