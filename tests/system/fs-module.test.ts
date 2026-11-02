import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  pathExists,
  ensureDir,
  ensureFile,
  isEmpty,
  readJson,
  writeJson,
  readText,
  writeText,
  readBinary,
  writeBinary,
  copy,
  move,
  remove,
  emptyDir,
  readDir,
  stat,
  checksum,
  pathInfo,
} from "../../src/main/modules/fs/fs-module";

describe("FS Module (Unit & Integration)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "electron-starter-fs-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理临时目录报错
    }
  });

  describe("Existence & Ensure", () => {
    it("pathExists correctly detects existence", async () => {
      const target = path.join(tempDir, "test.txt");
      expect(await pathExists(target)).toBe(false);
      await fs.writeFile(target, "hello");
      expect(await pathExists(target)).toBe(true);
    });

    it("ensureDir creates nested directories recursively", async () => {
      const nested = path.join(tempDir, "a", "b", "c");
      expect(await pathExists(nested)).toBe(false);
      const res = await ensureDir(nested);
      expect(res).toBe(true);
      expect(await pathExists(nested)).toBe(true);
    });

    it("ensureFile creates parent dirs and an empty file if not exists", async () => {
      const file = path.join(tempDir, "x", "y", "auto.txt");
      expect(await pathExists(file)).toBe(false);
      const res = await ensureFile(file);
      expect(res).toBe(true);
      expect(await pathExists(file)).toBe(true);
      const content = await fs.readFile(file, "utf-8");
      expect(content).toBe("");
    });

    it("isEmpty detects empty directories and zero-length files", async () => {
      const emptyFolder = path.join(tempDir, "empty");
      await fs.mkdir(emptyFolder);
      expect(await isEmpty(emptyFolder)).toBe(true);

      const emptyFile = path.join(tempDir, "zero.txt");
      await fs.writeFile(emptyFile, "");
      expect(await isEmpty(emptyFile)).toBe(true);

      const filledFile = path.join(tempDir, "filled.txt");
      await fs.writeFile(filledFile, "content");
      expect(await isEmpty(filledFile)).toBe(false);
    });
  });

  describe("Convenient Read & Write", () => {
    it("readJson and writeJson work with nested dirs and fallback", async () => {
      const jsonFile = path.join(tempDir, "sub", "config.json");
      const fallbackData = { defaultKey: "val" };

      // fallback
      const nonExistent = await readJson(jsonFile, fallbackData);
      expect(nonExistent).toEqual(fallbackData);

      // write
      const data = { name: "electron-starter", count: 42 };
      const ok = await writeJson(jsonFile, data, { spaces: 2 });
      expect(ok).toBe(true);

      // read back
      const loaded = await readJson(jsonFile);
      expect(loaded).toEqual(data);
    });

    it("readText and writeText support overwrite and append", async () => {
      const txtFile = path.join(tempDir, "dir", "test.txt");

      // fallback when missing
      const fallback = await readText(txtFile, { fallback: "default-text" });
      expect(fallback).toBe("default-text");

      // write
      await writeText(txtFile, "line1\n");
      expect(await readText(txtFile)).toBe("line1\n");

      // append
      await writeText(txtFile, "line2\n", { append: true });
      expect(await readText(txtFile)).toBe("line1\nline2\n");
    });

    it("readBinary and writeBinary handle base64 encoding correctly", async () => {
      const binFile = path.join(tempDir, "data.bin");
      const rawText = "Binary data \x00\x01\x02 test!";
      const base64 = Buffer.from(rawText, "utf-8").toString("base64");

      await writeBinary(binFile, base64);
      const readBack = await readBinary(binFile);
      expect(readBack).toBe(base64);

      const decoded = Buffer.from(readBack, "base64").toString("utf-8");
      expect(decoded).toBe(rawText);
    });
  });

  describe("File Operations: Copy, Move, Remove, EmptyDir", () => {
    it("copy copies files and directories recursively", async () => {
      const srcDir = path.join(tempDir, "src-folder");
      await fs.mkdir(srcDir);
      await fs.writeFile(path.join(srcDir, "1.txt"), "hello");

      const destDir = path.join(tempDir, "dest-folder");
      const ok = await copy(srcDir, destDir);
      expect(ok).toBe(true);
      expect(await fs.readFile(path.join(destDir, "1.txt"), "utf-8")).toBe("hello");
    });

    it("move moves files and handles destination parent creation", async () => {
      const src = path.join(tempDir, "source.txt");
      await fs.writeFile(src, "source content");

      const dest = path.join(tempDir, "target", "nested", "moved.txt");
      const ok = await move(src, dest);
      expect(ok).toBe(true);
      expect(await pathExists(src)).toBe(false);
      expect(await fs.readFile(dest, "utf-8")).toBe("source content");
    });

    it("remove idempotently deletes without throwing on missing paths", async () => {
      const nonExistent = path.join(tempDir, "not-here");
      expect(await remove(nonExistent)).toBe(true);

      const target = path.join(tempDir, "to-remove.txt");
      await fs.writeFile(target, "tmp");
      expect(await remove(target)).toBe(true);
      expect(await pathExists(target)).toBe(false);
    });

    it("emptyDir clears folder contents while keeping the folder", async () => {
      const folder = path.join(tempDir, "folder-to-empty");
      await fs.mkdir(folder);
      await fs.writeFile(path.join(folder, "sub.txt"), "sub");
      await fs.mkdir(path.join(folder, "sub-dir"));

      expect(await pathExists(folder)).toBe(true);
      const ok = await emptyDir(folder);
      expect(ok).toBe(true);
      expect(await pathExists(folder)).toBe(true);
      const list = await fs.readdir(folder);
      expect(list.length).toBe(0);
    });
  });

  describe("Metadata, Checksum & PathInfo", () => {
    it("checksum calculates accurate md5 and sha256 stream digests", async () => {
      const testFile = path.join(tempDir, "hash.txt");
      await fs.writeFile(testFile, "Antigravity Stream Checksum Test");

      const sha256 = await checksum(testFile, "sha256");
      expect(sha256).toMatch(/^[a-f0-9]{64}$/);

      const md5 = await checksum(testFile, "md5");
      expect(md5).toMatch(/^[a-f0-9]{32}$/);
    });

    it("stat returns comprehensive file metadata or null", async () => {
      const testFile = path.join(tempDir, "stat.txt");
      await fs.writeFile(testFile, "12345");

      const s = await stat(testFile);
      expect(s).not.toBeNull();
      expect(s?.size).toBe(5);
      expect(s?.isFile).toBe(true);
      expect(s?.isDirectory).toBe(false);

      const missingStat = await stat(path.join(tempDir, "no-file"));
      expect(missingStat).toBeNull();
    });

    it("readDir lists directory entries with accurate details", async () => {
      const testDir = path.join(tempDir, "dir-scan");
      await fs.mkdir(testDir);
      await fs.writeFile(path.join(testDir, "a.txt"), "A");
      await fs.mkdir(path.join(testDir, "sub"));

      const entries = await readDir(testDir);
      expect(entries.length).toBe(2);
      const fileEntry = entries.find((e) => e.name === "a.txt");
      expect(fileEntry?.isFile).toBe(true);
      expect(fileEntry?.size).toBe(1);

      const dirEntry = entries.find((e) => e.name === "sub");
      expect(dirEntry?.isDirectory).toBe(true);
    });

    it("pathInfo resolves paths into structured components", async () => {
      const info = await pathInfo("/home/user/notes/todo.md");
      expect(info.base).toBe("todo.md");
      expect(info.name).toBe("todo");
      expect(info.ext).toBe(".md");
      expect(info.dir).toBe("/home/user/notes");
      expect(info.isAbsolute).toBe(true);
    });
  });
});
