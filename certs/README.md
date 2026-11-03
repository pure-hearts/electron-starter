# 个人自签名代码签名证书体系 (Self-Signed Certificates)

本目录用于存放面向 Windows、macOS 与 Linux 平台的个人自签名证书与密钥套件。

> [!SECURITY]
> **安全声明**：
> 根目录 `.gitignore` 已对本目录内除 `.gitkeep` 和 `README.md` 之外的所有敏感凭证（`*.pfx`、`*.p12`、`*.key`、`*.cer`、`*.crt`、`*.pub`、`cert-info.json`）执行严格排除，**绝不会提交或泄露至 Git 仓库**。

---

## 1. 证书目录结构

```text
certs/
├── .gitkeep                      # 保持目录结构
├── README.md                     # 本说明文件
├── windows/                      # Windows Authenticode 签名证书
│   ├── code-sign.pfx             # 包含私钥的代码签名证书（用于打包签名）
│   ├── root-ca.cer               # 供测试机/客户机安装信任的公钥根证书
│   └── cert-info.json            # 证书指纹与元数据
├── macos/                        # macOS 代码签名证书
│   ├── mac-codesign.p12          # 包含私钥的个人证书包
│   ├── mac-root-ca.cer           # 供本地/测试机钥匙串信任的公钥证书
│   └── cert-info.json            # 证书指纹与钥匙串导入命令
└── linux/                        # Linux 安装包签名密钥
    ├── linux-signer.key          # 私钥
    ├── linux-signer.pub          # 公钥
    ├── linux-signer.crt          # 自签名 X.509 凭证
    └── cert-info.json            # 签名摘要
```

---

## 2. 常用管理命令

在项目根目录下通过 npm/pnpm 脚本执行：

```bash
# 一键生成三端个人证书与密钥（默认密码：dev-cert-password-123）
pnpm cert:generate

# 指定自定义密码生成
pnpm cert:generate -- --password MySecurePassword!

# 清理本地所有已生成的敏感证书与私钥
pnpm cert:clean
```

---

## 3. 客户端信任与安装指南

自签名证书没有商业权威 CA 的根信任。若要在测试机或企业内网机器上完全消除系统安全拦截，需在目标电脑上将公钥证书安装为受信任证书。

### 3.1 Windows 平台（消除 SmartScreen 未知发布者拦截）

只需分发 `certs/windows/root-ca.cer`（公钥文件，不含私钥）：

- **图形界面安装方式**：
  1. 双击 `root-ca.cer`，点击 **“安装证书...”**；
  2. 存储位置选择 **“本地计算机”**（需要管理员权限），点击下一步；
  3. 选择 **“将所有的证书都放入下列存储”** -> 点击 **“浏览”**；
  4. 分别或优先选择 **“受信任的根证书颁发机构”** 完成导入；
  5. 建议同时导入一份至 **“受信任的发布者”**。
- **PowerShell 管理员一键安装**：
  ```powershell
  # 以管理员身份在 PowerShell 中执行
  Import-Certificate -FilePath "certs/windows/root-ca.cer" -CertStoreLocation "Cert:\LocalMachine\Root"
  Import-Certificate -FilePath "certs/windows/root-ca.cer" -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher"
  ```

安装后，由该证书签名的安装包将在 Windows 识别为合法发布者，不再弹出蓝色未知发布者阻拦。

---

### 3.2 macOS 平台（本地签名与钥匙串信任）

- **导入本地钥匙串并信任**：
  ```bash
  # 导入代码签名身份至用户钥匙串
  security import certs/macos/mac-codesign.p12 -k ~/Library/Keychains/login.keychain-db -P "dev-cert-password-123" -T /usr/bin/codesign

  # 将根证书标记为代码签名完全信任
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/macos/mac-root-ca.cer
  ```

> [!NOTE]
> macOS 的 Gatekeeper 对公网下载应用要求 Apple 开发者账号签发的证书并完成云端公证（Notarization）。个人自签名证书适用于本地编译测试、局域网测试或通过企业 MDM 策略分发场景。

---

## 4. 构建签名机制

项目内置构建签名检测：

- 运行 `pnpm dist:win` 或 `pnpm dist:mac` 时，系统自动检测 `certs/` 目录下是否存在对应平台的私钥证书：
  - **存在证书**：自动注入签名凭证（`CSC_LINK` 与 `CSC_KEY_PASSWORD`），生成已带有数字签名的安装程序；
  - **不存在证书**：控制台输出提醒，自动平滑降级为无证书构建，不影响日常功能调试。
