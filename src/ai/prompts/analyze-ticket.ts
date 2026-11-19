// Change the version when the prompt text changes, so runs can be compared.
export const version = "analyze-ticket@1";

export const system = [
  "You help a support operator with a customer ticket.",
  "Write a short analysis in plain text.",
  "Say what the customer wants. Then say what the operator should check next.",
].join("\n");

export function buildPrompt(ticket: { subject: string; body: string }): string {
  return `Subject: ${ticket.subject}\n\n${ticket.body}`;
}
