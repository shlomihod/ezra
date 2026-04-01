import { describe, it, expect, vi } from "vitest";
import { nanoid } from "nanoid";

vi.mock("open", () => ({ default: vi.fn() }));

describe("ezra_open port handling", () => {
  it("retries next port on EADDRINUSE", async () => {
    vi.resetModules();

    let errorHandler: (err: NodeJS.ErrnoException) => void;
    const listenMock = vi.fn((port: number, cb?: () => void) => {
      if (port === 3333) {
        const err = new Error("EADDRINUSE") as NodeJS.ErrnoException;
        err.code = "EADDRINUSE";
        process.nextTick(() => errorHandler(err));
      } else {
        process.nextTick(() => cb?.());
      }
    });
    const onceMock = vi.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
      errorHandler = handler;
    });

    vi.doMock("../app.js", () => ({
      createApp: () => ({ server: { listen: listenMock, once: onceMock } }),
    }));

    const docId = "open-test-" + nanoid(6);
    const { createDocument } = await import("../db.js");
    createDocument(docId, "Port Test Doc", JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }));

    const { ezraOpen } = await import("../tools/open.js");
    vi.spyOn(await import("../ws.js"), "hasConnectedClients").mockReturnValue(false);

    const result = await ezraOpen(docId);

    expect(result.doc_id).toBe(docId);
    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(listenMock.mock.calls[0][0]).toBe(3333);
    expect(listenMock.mock.calls[1][0]).toBe(3334);

    const mockOpen = (await import("open")).default as ReturnType<typeof vi.fn>;
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining("localhost:3334"));
  });

  it("rejects after exhausting all ports", async () => {
    vi.resetModules();

    let errorHandler: (err: NodeJS.ErrnoException) => void;
    const onceMock = vi.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
      errorHandler = handler;
    });
    const listenMock = vi.fn((_port: number, _cb?: () => void) => {
      const err = new Error("EADDRINUSE") as NodeJS.ErrnoException;
      err.code = "EADDRINUSE";
      process.nextTick(() => errorHandler(err));
    });

    vi.doMock("../app.js", () => ({
      createApp: () => ({ server: { listen: listenMock, once: onceMock } }),
    }));

    const docId = "open-test-" + nanoid(6);
    const { createDocument } = await import("../db.js");
    createDocument(docId, "Port Test Doc", JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }));

    const { ezraOpen } = await import("../tools/open.js");

    await expect(ezraOpen(docId)).rejects.toThrow("EADDRINUSE");
    expect(listenMock).toHaveBeenCalledTimes(11);
  });

  it("succeeds immediately when port is available", async () => {
    vi.resetModules();

    const listenMock = vi.fn((_port: number, cb?: () => void) => {
      process.nextTick(() => cb?.());
    });
    const onceMock = vi.fn();

    vi.doMock("../app.js", () => ({
      createApp: () => ({ server: { listen: listenMock, once: onceMock } }),
    }));

    const docId = "open-test-" + nanoid(6);
    const { createDocument } = await import("../db.js");
    createDocument(docId, "Port Test Doc", JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }));

    const { ezraOpen } = await import("../tools/open.js");
    vi.spyOn(await import("../ws.js"), "hasConnectedClients").mockReturnValue(false);

    const result = await ezraOpen(docId);

    expect(result.doc_id).toBe(docId);
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0][0]).toBe(3333);

    const mockOpen = (await import("open")).default as ReturnType<typeof vi.fn>;
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining("localhost:3333"));
  });
});
