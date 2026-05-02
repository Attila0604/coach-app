type Props = {
  direction: string | null;
  content: string | null;
  agentName: string | null;
  createdAt: string | null;
};

function formatRelativeTime(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  if (isYesterday) return `gestern ${time}`;
  return `${d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  })} ${time}`;
}

export function MessageRow({
  direction,
  content,
  agentName,
  createdAt,
}: Props) {
  const isOut = direction === "out" || direction === "outbound";
  const isIn = direction === "in" || direction === "inbound";
  const dirLabel = isOut ? "BOT →" : isIn ? "← KUNDE" : "—";
  const dirColor = isOut ? "text-gold" : "text-bone-muted";

  return (
    <div className="py-4 border-b border-white/[0.06] last:border-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span
          className={`text-[9px] tracking-caps font-medium ${dirColor}`}
        >
          {dirLabel}
        </span>
        <span className="text-[10px] text-bone-muted tabular-nums">
          {formatRelativeTime(createdAt)}
        </span>
      </div>
      <p className="text-sm text-bone leading-snug whitespace-pre-wrap line-clamp-3">
        {content ?? "—"}
      </p>
      {agentName && (
        <p className="text-[9px] tracking-caps text-bone-faint mt-2 font-medium uppercase">
          {agentName}
        </p>
      )}
    </div>
  );
}
