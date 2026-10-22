import { describe, it, expect } from "vite-plus/test";
import { DeepLinkInbox } from "../src/main/modules/protocol/deep-link-inbox";
describe("Deep Link cold-start inbox", () => {
  it("buffers early URLs and drains once renderer subscribes", () => {
    const inbox = new DeepLinkInbox("electron-starter");
    const link = "electron-starter://open/?id=123";
    expect(inbox.accept(link)).toBe(link);
    expect(inbox.drain()).toEqual([link]);
    expect(inbox.drain()).toEqual([]);
  });
  it("rejects unexpected schemes, overlong links and invalid input", () => {
    const inbox = new DeepLinkInbox("electron-starter");
    expect(inbox.accept("https://example.com")).toBeNull();
    expect(inbox.accept("electron-starter://" + "x".repeat(2050))).toBeNull();
    expect(inbox.accept("not a url")).toBeNull();
    expect(inbox.length).toBe(0);
  });
  it("limits unconsumed URLs without discarding the most recent event", () => {
    const inbox = new DeepLinkInbox("electron-starter", 2);
    inbox.accept("electron-starter://one");
    inbox.accept("electron-starter://two");
    inbox.accept("electron-starter://three");
    expect(inbox.drain()).toEqual(["electron-starter://two", "electron-starter://three"]);
  });
});
