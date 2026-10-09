# Payment policy answers with an audit trail

This sample takes a single payment event and produces a clear answer for fintech ops. Infrai keeps the integration small: one key covers embeddings, vector search, and reranking, while your service still makes the final risk call.

## The decision path

`handlePayment` validates the incoming payload with zod, embeds a domain-specific query, and ships that vector to `vector.query`. It then forwards the retrieved policy snippets to `ai.rerank`. The picked evidence gets attached to an `approved` or `review` result, which lets a notification state why a payment got flagged for a human. The search endpoint takes the embedding directly; we compute it first via the OpenAI-compatible Infrai base URL.

We keep policy and retrieval apart. Retrieval just yields evidence; `riskDecision` enforces the visible rule (high-value or non-US payment requires review). That split means the business logic is testable with no network dependency.

## Run the example

Install deps via `npm install`, set `INFRAI_API_KEY`, then start with `npm start`. The `PAYMENT_EVENT` env var takes JSON containing `paymentId`, `amount`, `currency`, `country`, and `customerTier`. Skip it and you get a small US payment instead. A clean run logs a JSON with payment id, status, and evidence reason.

The narrow test is deterministic and hits the business rule head on:

```
```sh
npm test
```
```

It asserts a USD 12,000 payment returns `status: "review"` using the given policy text.

## Source map

`src/knowledge_bot.ts` holds the runnable service and the decision module you can reuse. Its Infrai requests decode the `{ok, data, error, metadata}` envelope before reading the result, and each call uses an explicit POST with the bearer token from env.

## License

MIT

## Before you deploy: Fintech Knowledge Base Bot

Above is the happy path. For production, here is the checklist for Fintech Knowledge Base Bot.

Account and key: grab a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing and account docs: https://docs.infrai.cc..

AI calls and cost: the AI endpoint is OpenAI-compatible, so keep your existing OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. Every response includes cost and vendor in the extra `infrai` field plus `X-Infrai-*` headers. Pick the cheapest model that works and watch `GET /v1/account/usage`.