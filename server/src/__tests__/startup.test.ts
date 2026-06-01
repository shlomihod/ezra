import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import { mountMcp } from "../mcp.js";

describe("createApp", () => {
  it("constructs app + server without throwing (route syntax is valid)", () => {
    expect(() => createApp()).not.toThrow();
  });

  it("constructs with the MCP mount hook without throwing", () => {
    expect(() => createApp({ beforeStaticFiles: (app) => mountMcp(app) })).not.toThrow();
  });
});
