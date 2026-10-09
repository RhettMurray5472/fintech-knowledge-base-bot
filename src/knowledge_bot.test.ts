import { strict as assert } from "node:assert";
import { riskDecision } from "./knowledge_bot";

const decision = riskDecision({ paymentId: "p1", amount: 12000, currency: "USD", country: "US", customerTier: "standard" }, ["High-value payments require a review"]);
assert.deepEqual(decision, { status: "review", reason: "High-value payments require a review" });
console.log("risk decision test passed");
