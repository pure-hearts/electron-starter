import { describe, expect, it } from "vite-plus/test";
import { filterStaleRevisions } from "../src/main/modules/update/hot/gc";

describe("hot update garbage collection filter", () => {
  it("keeps active and previous directories and pointer files", () => {
    const entries = [
      "current.json",
      "current.json.tmp",
      "rev-1",
      "rev-2",
      "rev-3",
      "other-file.txt",
    ];

    const stale = filterStaleRevisions(entries, "rev-3", "rev-2");

    // 仅 rev-1 是过期的 rev- 目录
    expect(stale).toEqual(["rev-1"]);
  });

  it("handles null or undefined active/previous safely", () => {
    const entries = ["current.json", "rev-1", "rev-2"];
    const stale = filterStaleRevisions(entries, "rev-2", null);

    expect(stale).toEqual(["rev-1"]);
  });

  it("does not report anything when no stale revisions exist", () => {
    const entries = ["current.json", "rev-5"];
    const stale = filterStaleRevisions(entries, "rev-5", null);

    expect(stale).toEqual([]);
  });
});
