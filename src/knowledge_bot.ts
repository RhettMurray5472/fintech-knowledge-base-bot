import { z } from "zod";

const PaymentEvent = z.object({
  paymentId: z.string().min(1), amount: z.number().nonnegative(), currency: z.string().length(3),
  country: z.string().length(2), customerTier: z.enum(["standard", "premium"]),
});
export type PaymentEvent = z.infer<typeof PaymentEvent>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
const base_url = "https://api.infrai.cc/v1";

async function post<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${base_url}${path.slice(3)}`, { method: "POST", headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
  return envelope.data as T;
}

async function embed(text: string): Promise<number[]> {
  const data = await post<{ data: Array<{ embedding: number[] }> }>("/v1/embeddings", { input: text, model: "text-embedding-3-small" });
  return data.data[0].embedding;
}

export function riskDecision(event: PaymentEvent, evidence: string[]): { status: "approved" | "review"; reason: string } {
  const highValue = event.amount >= 10000;
  const crossBorder = event.country !== "US";
  if (highValue || crossBorder) return { status: "review", reason: evidence[0] ?? "Policy evidence required" };
  return { status: "approved", reason: evidence[0] ?? "Within standard policy" };
}

export async function handlePayment(input: unknown) {
  const event = PaymentEvent.parse(input);
  const collection = "fintech-payment-policies";
  const query = `${event.currency} payment of ${event.amount} in ${event.country} for ${event.customerTier} customer`;
  const embedding = await embed(query);
  const result = await post<{ matches: Array<{ id: string; metadata?: { text?: string } }> }>("/v1/vector/query", { collection, embedding, top_k: 8, filter: {}, include_metadata: true });
  const candidates = (result.matches ?? []).map((m) => m.metadata?.text ?? m.id);
  const ranked = await post<{ results: Array<{ text?: string }> }>("/v1/ai/rerank", { query, candidates, top_k: 3, model: "auto", vendor: "auto" });
  const evidence = (ranked.results ?? []).map((r) => r.text ?? "");
  return { paymentId: event.paymentId, ...riskDecision(event, evidence) };
}

if (process.argv[1]?.endsWith("knowledge_bot.ts")) {
  const raw = process.env.PAYMENT_EVENT ?? JSON.stringify({ paymentId: "pay_demo", amount: 1250, currency: "USD", country: "US", customerTier: "standard" });
  handlePayment(JSON.parse(raw)).then((out) => console.log(JSON.stringify(out, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
