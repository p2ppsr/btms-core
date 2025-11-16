// src/localOverlay.ts

import { TokensProvider } from "./providers/tokens";
import { MarketplaceProvider } from "./providers/marketplace";

type LookupBody = {
  provider: string;
  query: any;
};

type SubmitBody = {
  provider?: string;
  topics?: string[];
  [key: string]: any;
};

// minimal response-like shape for Node environments without fetch globals
class SimpleResponse {
  ok: boolean;
  status: number;
  private _body: string;
  headers: Record<string, string>;

  constructor(
    body: any,
    init: { status?: number; headers?: Record<string, string> } = {},
  ) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this._body = typeof body === "string" ? body : JSON.stringify(body);
    this.headers = init.headers ?? { "Content-Type": "application/json" };
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }
}

export interface OverlayProvider {
  name: string;
  lookup(query: any): Promise<any[]>;
  submit(
    body: any,
  ): Promise<{ status: string; topics?: Record<string, number[]> }>;
}

/**
 * Create an in-memory overlay that exposes /lookup and /submit just like the
 * remote Babbage overlay, but lives in this process.
 *
 * You can register more providers if your btms framework needs them.
 */
export function createLocalOverlay() {
  const providers = new Map<string, OverlayProvider>();

  // register the two you already need
  const tokens = new TokensProvider();
  const marketplace = new MarketplaceProvider();
  providers.set(tokens.name, tokens);
  providers.set(marketplace.name, marketplace);

  function registerProvider(p: OverlayProvider) {
    providers.set(p.name, p);
  }

  /**
   * This is the function you hand to BTMS as its "requester".
   * It looks enough like fetch(...) that index.ts won't know the difference.
   */
  async function requester(url: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method || "GET").toUpperCase();

    // slice off everything before the last / so we can match /lookup, /submit
    const path = url.replace(/^https?:\/\/[^/]+/, "");

    if (method !== "POST") {
      return new SimpleResponse(
        { error: "Only POST supported in local overlay" },
        { status: 405 },
      ) as any;
    }

    const bodyText = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(bodyText);

    if (path.endsWith("/lookup")) {
      const { provider, query } = body as LookupBody;
      const p = providers.get(provider);
      if (!p) {
        return new SimpleResponse(
          { error: `Unknown provider ${provider}` },
          { status: 404 },
        ) as any;
      }
      const items = await p.lookup(query);
      return new SimpleResponse(items, { status: 200 }) as any;
    }

    if (path.endsWith("/submit")) {
      // the remote overlay just echos a {status:'success', topics:...}
      // and also tends to let the provider store stuff
      const { provider = "tokens", ...rest } = body as SubmitBody;
      const p = providers.get(provider);
      if (!p) {
        return new SimpleResponse(
          { error: `Unknown provider ${provider}` },
          { status: 404 },
        ) as any;
      }
      const result = await p.submit(rest);
      return new SimpleResponse(result, { status: 200 }) as any;
    }

    return new SimpleResponse(
      { error: `Unknown path ${path}` },
      { status: 404 },
    ) as any;
  }

  return {
    requester,
    registerProvider,
  };
}
