// Instagram/WhatsApp AI provider. Requires Node.js 18 or newer.
function createSalesAI({ env = process.env, fetchImpl = globalThis.fetch, anthropic }) {
  const provider = (env.AI_PROVIDER || "openai").trim().toLowerCase();
  if (!["openai", "anthropic"].includes(provider)) {
    throw new Error("AI_PROVIDER must be openai or anthropic");
  }
  if (provider === "openai" && !env.OPENAI_API_KEY) {
    throw new Error("Add OPENAI_API_KEY to your backend environment variables");
  }

  return {
    async generateText({ system, messages, maxOutputTokens = 300 }) {
      if (provider === "anthropic") {
        const response = await anthropic.messages.create({
          model: env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
          system, messages, max_tokens: maxOutputTokens
        });
        if (response.stop_reason === "max_tokens") {
          throw new Error("AI reply was truncated; no order action will be executed");
        }
        const text = (response.content || [])
          .filter(part => part.type === "text")
          .map(part => part.text).join("");
        if (!text.trim()) throw new Error("AI returned an empty reply");
        return text;
      }

      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-6-luna",
          instructions: system,
          input: messages,
          max_output_tokens: maxOutputTokens,
          reasoning: { effort: "none" },
          store: false
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const error = new Error(`OpenAI request failed (HTTP ${response.status})`);
        error.status = response.status;
        throw error;
      }
      const result = await response.json();
      if (result.status !== "completed") {
        throw new Error("OpenAI reply did not complete; no order action will be executed");
      }
      const content = (result.output || [])
        .filter(item => item.type === "message")
        .flatMap(item => item.content || []);
      if (content.some(part => part.type === "refusal")) {
        throw new Error("OpenAI could not answer this request");
      }
      const text = content.filter(part => part.type === "output_text")
        .map(part => part.text).join("");
      if (!text.trim()) throw new Error("OpenAI returned an empty reply");
      return text;
    }
  };
}

module.exports = { createSalesAI };
