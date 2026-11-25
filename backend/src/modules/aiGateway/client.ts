import { env } from "../../config/env.js";

export type AiGatewayMessage = {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
};

export type AiGatewayChatRequest = {
  model: string;
  messages: readonly AiGatewayMessage[];
};

export async function createChatCompletion(
  request: AiGatewayChatRequest,
): Promise<unknown> {
  const { NEON_AI_GATEWAY_BASE_URL, NEON_AI_GATEWAY_TOKEN } = env;

  if (!NEON_AI_GATEWAY_BASE_URL || !NEON_AI_GATEWAY_TOKEN) {
    throw new Error("Neon AI Gateway is not configured.");
  }

  const endpoint = new URL("/v1/chat/completions", NEON_AI_GATEWAY_BASE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${NEON_AI_GATEWAY_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Neon AI Gateway returned HTTP ${response.status}.`);
  }

  const result: unknown = await response.json();
  return result;
}
