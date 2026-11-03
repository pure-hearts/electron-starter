/**
 * @file build-chunk-split.ts
 * @description 规范化静态资源输出路径与四层缓存金字塔代码分包配置。
 * 针对 Web 浏览器与 Electron 双模态动态调整分包阈值。
 */

export interface AssetInfo {
  names?: string[];
}

/**
 * 创建规范化资源分类及 Rolldown 代码分包策略
 * @param isWeb 是否为纯 Web 浏览器构建环境
 */
export function createBuildOutputOptions(isWeb: boolean) {
  return {
    // 规范化脚本输出目录
    entryFileNames: "assets/js/[name]-[hash].js",
    chunkFileNames: "assets/js/[name]-[hash].js",
    // 规范化静态资源输出目录
    assetFileNames: (assetInfo: AssetInfo) => {
      const name = assetInfo.names?.[0] ?? "";
      if (name.endsWith(".css")) return "assets/css/[name]-[hash][extname]";
      if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) return "assets/img/[name]-[hash][extname]";
      if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) return "assets/fonts/[name]-[hash][extname]";
      return "assets/other/[name]-[hash][extname]";
    },
    // 四层缓存金字塔与双端双模态分包
    codeSplitting: {
      groups: [
        // L1: 核心框架内核（极高缓存稳定性，priority: 40）
        {
          name: "vue-core",
          test: /[\\/]node_modules[\\/](vue|vue-router|pinia|vue-i18n|@vue)[\\/]/,
          priority: 40,
        },
        // L2: 通用网络与基础工具库（priority: 30）
        {
          name: "infra-vendor",
          test: /[\\/]node_modules[\\/](axios|@vueuse|lodash-es)[\\/]/,
          priority: 30,
        },
        // L3: UI 组件库（按需入口感知，消除首屏连坐，priority: 20）
        {
          name: "naive-ui",
          test: /[\\/]node_modules[\\/](naive-ui|vueuc|evtd|vooks|css-render|seemly)[\\/]/,
          priority: 20,
          entriesAware: true,
          entriesAwareMergeThreshold: isWeb ? 20_000 : 35_000,
        },
        // L4: 公共三方库兜底提取（仅多处共享且达到阈值时独立，priority: 10）
        {
          name: "vendor-shared",
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          minShareCount: 2,
          minSize: isWeb ? 15_000 : 30_000,
        },
      ],
    },
  };
}
