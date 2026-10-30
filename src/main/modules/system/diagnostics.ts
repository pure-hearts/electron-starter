/**
 * @file diagnostics.ts
 * @description 系统诊断信息采集与脱敏日志打包导出。
 */
import os from "node:os";
import fs from "node:fs";
import { app, dialog } from "electron";
import { zipSync, strToU8 } from "fflate";
import type { SystemDiagnostics } from "../../../shared/ipc";
import { log } from "../core/logger";
import { redactLogMessage } from "../core/log-redaction";
import { getMainWindow } from "../../window";

/**
 * 采集当前系统硬件与运行环境参数
 */
export function getSystemDiagnostics(): SystemDiagnostics {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : "Unknown CPU";
  let logPath = "";
  try {
    logPath = log.transports.file.getFile().path;
  } catch {
    logPath = "";
  }

  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron || "",
    chromeVersion: process.versions.chrome || "",
    nodeVersion: process.versions.node || "",
    v8Version: process.versions.v8 || "",
    osPlatform: process.platform,
    osRelease: os.release(),
    osArch: process.arch,
    cpuModel,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
    uptimeSeconds: Math.round(os.uptime()),
    isPackaged: app.isPackaged,
    logPath,
  };
}

/**
 * 收集日志与系统信息，生成脱敏 ZIP 诊断包并弹窗供用户保存
 */
export async function exportDiagnosticLogs(): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    const diagnostics = getSystemDiagnostics();
    const zipFiles: Record<string, Uint8Array> = {};

    // 1. 写入环境参数报告
    zipFiles["diagnostics-summary.json"] = strToU8(JSON.stringify(diagnostics, null, 2));

    // 2. 读取并脱敏主日志文件
    if (diagnostics.logPath && fs.existsSync(diagnostics.logPath)) {
      try {
        const rawContent = fs.readFileSync(diagnostics.logPath, "utf-8");
        // 按行脱敏
        const sanitizedLines = rawContent
          .split("\n")
          .map((line) => redactLogMessage(line))
          .join("\n");
        zipFiles["logs/main.log"] = strToU8(sanitizedLines);
      } catch (err) {
        log.warn("Failed to read log file for export", err);
      }
    }

    // 3. 打包为 ZIP 字节流
    const zippedBuffer = zipSync(zipFiles);

    // 4. 弹出系统原生保存文件对话框
    const win = getMainWindow();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const defaultFilename = `electron-starter-diagnostics-${timestamp}.zip`;

    const saveOptions = {
      title: "导出系统诊断与排障日志",
      defaultPath: defaultFilename,
      filters: [{ name: "ZIP 压缩文件", extensions: ["zip"] }],
    };

    const saveResult = win
      ? await dialog.showSaveDialog(win, saveOptions)
      : await dialog.showSaveDialog(saveOptions);

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, error: "用户取消了导出" };
    }

    // 5. 写入选定磁盘路径
    fs.writeFileSync(saveResult.filePath, Buffer.from(zippedBuffer));
    log.info(`Diagnostic logs exported successfully to: ${saveResult.filePath}`);
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "导出排障日志失败";
    log.error("Error exporting diagnostic logs", err);
    return { success: false, error: errorMsg };
  }
}
