// Phase 2 placeholder — Claude Opus integration

export async function getAIReply(params: {
  message: string;
  userId: string;
  triggerId: string;
  conversationHistory?: string[];
  personality?: string;
  brandVoice?: string;
  language?: string;
}): Promise<{ reply: string; qualifiedLead: boolean; suggestWhatsapp: boolean }> {
  // TODO Phase 2 — Claude Opus integration
  console.warn("AI replies are a Phase 2 feature");
  throw new Error("AI replies available in Phase 2 — upgrade to Pro");
}
