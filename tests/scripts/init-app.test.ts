import { describe, expect, it } from "vite-plus/test";
import {
  toKebabCase,
  validateSlug,
  validateAppId,
  validateScheme,
  updatePackageJson,
  updateElectronBuilderYml,
  updateEnvFile,
  updateAppConfigJson,
  updateAppUpdateYml,
  updateHtmlTitle,
  planInitChanges,
  parseCliArgs,
  type InitAppOptions,
} from "../../scripts/init-app";

describe("init-app script tests", () => {
  const mockOptions: InitAppOptions = {
    productName: "Super Notes",
    slug: "super-notes",
    appId: "com.supercorp.supernotes",
    scheme: "super-notes",
    authorName: "Alice",
    authorEmail: "alice@example.com",
    githubOwner: "supercorp",
    githubRepo: "super-notes",
    description: "A super desktop notes application",
  };

  describe("utility functions", () => {
    it("converts product names to kebab-case slug", () => {
      expect(toKebabCase("Super Notes App")).toBe("super-notes-app");
      expect(toKebabCase("myDesktopApp")).toBe("my-desktop-app");
      expect(toKebabCase("  Extra   Spaces  ")).toBe("extra-spaces");
      expect(toKebabCase("Special_Char$*Name")).toBe("special-char-name");
      expect(toKebabCase("")).toBe("my-desktop-app");
    });

    it("validates slug", () => {
      expect(validateSlug("my-app")).toBe(true);
      expect(validateSlug("myapp2")).toBe(true);
      expect(validateSlug("a")).toBe(false); // too short
      expect(validateSlug("-myapp")).toBe(false);
      expect(validateSlug("my_app")).toBe(false);
      expect(validateSlug("MyApp")).toBe(false);
    });

    it("validates appId", () => {
      expect(validateAppId("com.company.app")).toBe(true);
      expect(validateAppId("org.example.my_app")).toBe(true);
      expect(validateAppId("invalidAppId")).toBe(false);
      expect(validateAppId("com.")).toBe(false);
    });

    it("validates scheme", () => {
      expect(validateScheme("my-app")).toBe(true);
      expect(validateScheme("customapp123")).toBe(true);
      expect(validateScheme("Invalid_Scheme!")).toBe(false);
    });
  });

  describe("file content updaters", () => {
    it("updates package.json without destroying other properties", () => {
      const rawPkg = JSON.stringify(
        {
          name: "old-name",
          version: "0.1.0",
          desktopName: "old-name",
          scripts: { dev: "vp dev" },
          dependencies: { vue: "^3.0.0" },
        },
        null,
        2,
      );

      const updated = JSON.parse(updatePackageJson(rawPkg, mockOptions));
      expect(updated.name).toBe("super-notes");
      expect(updated.desktopName).toBe("super-notes");
      expect(updated.author).toEqual({
        name: "Alice",
        email: "alice@example.com",
      });
      expect(updated.version).toBe("0.1.0");
      expect(updated.scripts.dev).toBe("vp dev");
    });

    it("updates electron-builder.yml while preserving existing comments", () => {
      const rawYml = `# App ID comment\nappId: org.old.id\nproductName: Old Product\nprotocols:\n  - name: Old Links\n    schemes:\n      - old-scheme\npublish:\n  provider: github\n  owner: old-owner\n  repo: old-repo\n`;
      const updated = updateElectronBuilderYml(rawYml, mockOptions);

      expect(updated).toContain("# App ID comment");
      expect(updated).toContain("appId: com.supercorp.supernotes");
      expect(updated).toContain("productName: Super Notes");
      expect(updated).toContain("- name: Super Notes Links");
      expect(updated).toContain("- super-notes");
      expect(updated).toContain("owner: supercorp");
      expect(updated).toContain("repo: super-notes");
    });

    it("updates .env content while preserving comments", () => {
      const rawEnv = `# Client env\nVITE_APP_TITLE=Old Title\nVITE_APP_DEEP_LINK_SCHEME=old-scheme\nAPP_NAME=old-name\nAPP_USER_MODEL_ID=old.id\nAPP_DEEP_LINK_SCHEME=old-scheme\nHOT_UPDATE_URL=https://github.com/old/repo/releases/latest/download/manifest.json\n`;
      const updated = updateEnvFile(rawEnv, mockOptions);

      expect(updated).toContain("# Client env");
      expect(updated).toContain("VITE_APP_TITLE=Super Notes");
      expect(updated).toContain("VITE_APP_DEEP_LINK_SCHEME=super-notes");
      expect(updated).toContain("APP_NAME=super-notes");
      expect(updated).toContain("APP_USER_MODEL_ID=com.supercorp.supernotes");
      expect(updated).toContain("APP_DEEP_LINK_SCHEME=super-notes");
      expect(updated).toContain(
        "HOT_UPDATE_URL=https://github.com/supercorp/super-notes/releases/latest/download/manifest.json",
      );
    });

    it("updates app-config.json and app-update.yml", () => {
      const rawConfig = JSON.stringify({
        appUpdateUrl: "",
        hotUpdateUrl: "https://github.com/old/repo/releases/latest/download/manifest.json",
        deepLinkScheme: "old-scheme",
      });
      const updatedConfig = JSON.parse(updateAppConfigJson(rawConfig, mockOptions));
      expect(updatedConfig.deepLinkScheme).toBe("super-notes");
      expect(updatedConfig.hotUpdateUrl).toContain("supercorp/super-notes");

      const rawUpdateYml = `owner: old-owner\nrepo: old-repo\nprovider: github\nupdaterCacheDirName: old-updater\n`;
      const updatedUpdateYml = updateAppUpdateYml(rawUpdateYml, mockOptions);
      expect(updatedUpdateYml).toContain("owner: supercorp");
      expect(updatedUpdateYml).toContain("repo: super-notes");
      expect(updatedUpdateYml).toContain("updaterCacheDirName: super-notes-updater");
    });

    it("updates HTML title tag", () => {
      const rawHtml = `<!DOCTYPE html><html><head><title>Old Title</title></head><body></body></html>`;
      const updated = updateHtmlTitle(rawHtml, "Super Notes");
      expect(updated).toContain("<title>Super Notes</title>");
    });

    it("plans changes across project files correctly", () => {
      // 针对当前项目实际文件测试 planInitChanges（验证所有目标路径均能匹配并计划出正确的相对路径）
      const changes = planInitChanges(mockOptions, process.cwd());
      expect(changes.length).toBeGreaterThanOrEqual(8);
      const changedRelPaths = changes.filter((c) => c.changed).map((c) => c.relativePath);
      expect(changedRelPaths).toContain("package.json");
      expect(changedRelPaths).toContain("electron-builder.yml");
      expect(changedRelPaths).toContain(".env.example");
      expect(changedRelPaths).toContain("resources/app-config.json");
      expect(changedRelPaths).toContain("resources/app-update.yml");
    });
  });

  describe("CLI arguments parsing", () => {
    it("parses shorthand and full arguments", () => {
      const args = [
        "-n",
        "Awesome Client",
        "-s",
        "awesome-client",
        "--app-id",
        "com.awesome.client",
        "--scheme",
        "awesome-client",
        "--repo",
        "awesome-org/awesome-client",
        "--dry-run",
        "-y",
      ];
      const parsed = parseCliArgs(args);
      expect(parsed.productName).toBe("Awesome Client");
      expect(parsed.slug).toBe("awesome-client");
      expect(parsed.appId).toBe("com.awesome.client");
      expect(parsed.scheme).toBe("awesome-client");
      expect(parsed.githubOwner).toBe("awesome-org");
      expect(parsed.githubRepo).toBe("awesome-client");
      expect(parsed.dryRun).toBe(true);
      expect(parsed.yes).toBe(true);
    });
  });
});
