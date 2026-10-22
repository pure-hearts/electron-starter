import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
// 默认扫描 release 目录，也允许从命令行传入其他产物目录。
const releaseDir = path.resolve(process.argv[2] || "release");
if (!fs.existsSync(releaseDir)) throw new Error("Missing release artifacts");
// 仅对最终发行文件计算摘要，不把中间构建目录加入清单。
const accepted = [".exe", ".dmg", ".zip", ".AppImage", ".deb"];
// 对文件名排序，保证生成的校验清单顺序稳定、方便比对。
const targets = fs
  .readdirSync(releaseDir)
  .filter(
    (name) =>
      accepted.some((ext) => name.endsWith(ext)) &&
      fs.statSync(path.join(releaseDir, name)).isFile(),
  )
  .sort();
if (!targets.length) throw new Error("No distribution installers found");
// SHA-256 以十六进制表示；每行记录摘要和对应安装包文件名。
const lines = targets.map(
  (name) =>
    createHash("sha256")
      .update(fs.readFileSync(path.join(releaseDir, name)))
      .digest("hex") +
    "  " +
    name,
);
// 发布时用户可通过 SHA256SUMS.txt 验证下载文件完整性；它不代表代码签名。
fs.writeFileSync(path.join(releaseDir, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log("Wrote checksums for " + targets.length + " artifacts");
