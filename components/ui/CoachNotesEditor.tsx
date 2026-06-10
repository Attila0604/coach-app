"use client";

import { useState, useTransition } from "react";
import {
  saveCoachNote,
  deactivateCoachNote,
} from "@/app/coach/customers/[id]/actions";

type Note = {
  id: string;
  content: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

type Props = {
  customerId: string;
  activeNote: Note | null;
  notesHistory: Note[];
};

const NOTE_MAX_LENGTH = 500;

function timeAgoDe(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "gerade eben";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CoachNotesEditor({
  customerId,
  activeNote,
  notesHistory,
}: Props) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await saveCoachNote(customerId, content);
      if (result.ok) {
        setContent("");
      } else {
        setError(result.error);
      }
    });
  };

  const handleDeactivate = (noteId: string) => {
    if (!confirm("Diese Notiz wirklich deaktivieren?")) return;
    setError(null);

    startTransition(async () => {
      const result = await deactivateCoachNote(noteId, customerId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
      <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
        Nachricht an Kunde
      </h3>

      {activeNote && (
        <div className="mb-6 border-l-2 border-gold/40 pl-4 py-1">
          <p className="text-[9px] tracking-caps uppercase text-gold font-medium mb-2">
            Aktive Notiz
          </p>
          <p className="font-serif text-base text-bone italic leading-relaxed mb-3">
            &ldquo;{activeNote.content}&rdquo;
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] uppercase tracking-caps text-bone-faint">
              {timeAgoDe(activeNote.created_at)}
            </p>
            <button
              type="button"
              onClick={() => handleDeactivate(activeNote.id)}
              disabled={isPending}
              className="text-[10px] uppercase tracking-caps text-bone-muted hover:text-gold transition disabled:opacity-50"
            >
              Deaktivieren
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            activeNote
              ? "Neue Nachricht (ersetzt aktive Notiz)..."
              : "Was möchtest du dem Kunden mitteilen?"
          }
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          disabled={isPending}
          className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone placeholder:text-bone-faint focus:outline-none focus:border-gold/50 transition resize-none disabled:opacity-50"
        />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] text-bone-faint tabular-nums">
            {content.length}/{NOTE_MAX_LENGTH}
          </p>
          <button
            type="submit"
            disabled={!content.trim() || isPending}
            className="text-[10px] uppercase tracking-caps font-medium px-4 py-2 border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPending ? "Sendet…" : "An Kunde senden"}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-red-400 italic">{error}</p>
        )}
      </form>

      {notesHistory.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/[0.06]">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-3">
            Verlauf · {notesHistory.length}
          </p>
          <ul className="space-y-3">
            {notesHistory.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="text-bone-muted italic line-clamp-2">
                  &ldquo;{n.content}&rdquo;
                </p>
                <p className="text-[10px] uppercase tracking-caps text-bone-faint mt-1">
                  {timeAgoDe(n.created_at)} · inaktiv
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
