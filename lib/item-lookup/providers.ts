import type {
  ItemLookupResult,
  RetailerLookupProvider,
  SearchOptions
} from "@/lib/item-lookup/types";

class DisabledProvider implements RetailerLookupProvider {
  async searchItems() {
    return [];
  }

  async getItemDetails() {
    return null;
  }
}

class MockLookupProvider implements RetailerLookupProvider {
  async searchItems(query: string, options?: SearchOptions) {
    const now = new Date().toISOString();
    const normalized = query.trim();
    if (!normalized) return [];

    const results: ItemLookupResult[] = [
      {
        provider: "mock",
        externalId: `mock-${Buffer.from(normalized).toString("base64url").slice(0, 24)}-1`,
        title: normalized,
        brand: "Manual estimate",
        retailer: "Mock Retailer",
        price: 9.99,
        currency: "USD",
        availability: "mock",
        lastCheckedAt: now
      },
      {
        provider: "mock",
        externalId: `mock-${Buffer.from(normalized).toString("base64url").slice(0, 24)}-2`,
        title: `${normalized} family pack`,
        retailer: "Mock Retailer",
        price: 19.99,
        currency: "USD",
        availability: "mock",
        lastCheckedAt: now
      }
    ];

    return results.slice(0, options?.limit || 8);
  }

  async getItemDetails(externalId: string) {
    return {
      provider: "mock",
      externalId,
      title: "Mock item",
      retailer: "Mock Retailer",
      price: 9.99,
      currency: "USD",
      availability: "mock",
      lastCheckedAt: new Date().toISOString()
    };
  }
}

export function createLookupProvider(provider: string): RetailerLookupProvider {
  if (provider === "mock") return new MockLookupProvider();
  return new DisabledProvider();
}
