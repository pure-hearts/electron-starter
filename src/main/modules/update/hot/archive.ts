/** ZIP 资源解压安全边界：仅解压渲染资源，限制文件数和解压后容量，并阻止路径穿越。 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

// 防止恶意 ZIP 携带海量文件耗尽文件句柄或磁盘资源。
const MAX_FILES = 800;
// 解压后的文件总体积上限，降低 ZIP 炸弹风险。
const MAX_EXPANDED = 128 * 1024 * 1024;

/** 解压前检查数量/体积，写盘前逐条验证目标路径。 */
export function extractSafe(zip: Uint8Array, directory: string): void {
  let count = 0;
  let total = 0;
  // fflate 的 filter 会在解压处理时逐条统计原始解压体积。
  const files = unzipSync(zip, {
    filter(info) {
      count++;
      total += info.originalSize;
      if (count > MAX_FILES || total > MAX_EXPANDED) throw new Error("ZIP limits exceeded");
      return true;
    },
  });
  // 将输出目录规范化，用于判断 ZIP 内路径是否越界。
  const root = path.resolve(directory);
  for (const [name, bytes] of Object.entries(files)) {
    if (
      !name ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.includes("\0") ||
      name.split("/").some((p) => p === "..")
    ) {
      throw new Error("Unsafe ZIP path");
    }
    if (name.endsWith("/")) continue;
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new Error("Unsafe ZIP target");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx" });
  }
  if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Missing index.html");
}
