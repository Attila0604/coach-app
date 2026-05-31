import Link from 'next/link';
import { STATUS_LABELS } from '@/lib/coach-customer-helpers';

const CUSTOMER_NAV = [
  { href: '', label: 'Übersicht' },
  { href: 'profile', label: 'Profil' },
  { href: 'nutrition', label: 'Ernährung' },
  { href: 'training', label: 'Training' },
  { href: 'activity', label: 'Aktivität' },
];

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
    active: 'border-gold/30 bg-gold/10 text-gold',
    intake: 'border-bone/20 bg-white/[0.04] text-bone',
    paused: 'border-bone-muted/20 bg-white/[0.03] text-bone-muted',
    archived: 'border-bone-faint/30 bg-black/10 text-bone-faint',
  };
  const style = styles[status] ?? styles.paused;
  const label = STATUS_LABELS[status] ?? status;

  return (
    <div className="mb-8">
      <Link
        href={`/coach/customers/${customerId}`}
        className="mb-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-caps text-bone-faint transition-colors hover:text-gold"
      >
        <span>←</span>
        <span>{backLabel}</span>
      </Link>

      <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-gold/[0.05] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-caps text-gold">
              Kunde
            </p>
            <h1 className="font-serif text-3xl leading-tight text-bone sm:text-4xl">
              {displayName}
            </h1>
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-caps ${style}`}
          >
            {label}
          </span>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {CUSTOMER_NAV.map((item) => {
            const href = item.href
              ? `/coach/customers/${customerId}/${item.href}`
              : `/coach/customers/${customerId}`;
            return (
              <Link
                key={item.href || 'overview'}
                href={href}
                className="whitespace-nowrap rounded-full border border-white/[0.08] bg-black/15 px-3 py-1.5 text-[10px] font-medium uppercase tracking-capsTight text-bone-muted transition hover:border-gold/25 hover:bg-gold/10 hover:text-gold"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
