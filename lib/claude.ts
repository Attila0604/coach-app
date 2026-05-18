// lib/claude.ts
// Wrapper für Anthropic Claude API. Server-only.

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeOptions = {
  model?: string;
  maxTokens?: number;
  system?: string;
  temperature?: number;
};

export async function callClaude(
  messages: Message[],
  options: ClaudeOptions = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || "claude-sonnet-4-6",
      max_tokens: options.maxTokens || 4000,
      ...(options.system ? { system: options.system } : {}),
      messages,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Claude API Fehler ${response.status}: ${errorText || response.statusText}`
    );
  }

  const data = await response.json();

  const textBlock = data.content?.find(
    (b: { type: string; text?: string }) => b.type === "text"
  );
  if (!textBlock?.text) {
    throw new Error("Claude lieferte keinen Text zurück.");
  }

  return textBlock.text;
}
