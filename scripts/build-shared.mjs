import { validateContract } from "./contract.mjs";

// These helpers are vendored release inputs, not generated from a sibling checkout.
validateContract();
console.error("Local SDK contract, operation policies and shared helper hashes match.");
