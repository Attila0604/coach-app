// Proaktiver Telegram-Push an den Bot.
//
// Wird beim Freigeben eines Plans aufgerufen. Best-effort: schlägt der Push fehl
// (Bot offline, Secret falsch, nicht konfiguriert), wird das geschluckt — die
// Freigabe selbst darf daran NICHT scheitern. Ob der Kunde den Push wirklich
// will (meal_plan_via_telegram) entscheidet der Bot.
//
// Benötigte Env-Variablen (Vercel):
//   COACH_BOT_URL      z.B. https://<dein-bot>.up.railway.app
//   COACH_PUSH_SECRET  gleicher Wert wie PUSH_SECRET im Bot (Railway)

export async function pushMealPlanViaTelegram(customerId: string): Promise<void> {
  const base = process.env.COACH_BOT_URL;
  const secret = process.env.COACH_PUSH_SECRET;
  if (!base || !secret || !customerId) return; // nicht konfiguriert -> No-Op

  const url = `${base.replace(/\/+$/, "")}/push/meal-plan`;

  // Kurzer Timeout, damit die Server-Action nicht hängt.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Push-Secret": secret,
      },
      body: JSON.stringify({ customer_id: customerId }),
      signal: controller.signal,
    });
  } catch {
    // bewusst geschluckt — Push ist best-effort
  } finally {
    clearTimeout(timeout);
  }
}
