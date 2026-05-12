# 生化试剂出入库管理（桌面版）

基于 Tauri 的桌面应用，支持坚果云多人同步。

## 环境要求

- **Rust**（1.70+）
- **Node.js**（18+）

## 安装步骤

### 1. 安装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. 安装 Node.js 依赖

```bash
npm install
```

### 3. 运行开发版

```bash
npm run dev
```

### 4. 打包发布

```bash
# macOS
npm run build

# 打包后的应用在 src-tauri/target/release/bundle/
```

## 坚果云同步

应用会自动检测坚果云同步目录：
- macOS: `~/Nutstore/` 或 `~/坚果云/`
- Windows: `C:\Users\<用户名>\Nutstore\`

同步数据保存在 `reagent-inventory/` 子目录下：
```
Nutstore/
└── reagent-inventory/
    ├── snapshot.json          # 完整数据快照
    └── operations/            # 操作日志（可选）
```

多人使用时，每个人安装本应用并登录同一个坚果云账号，数据会自动同步。

## 冲突处理

当多人同时修改同一数据时，采用**最后写入胜**策略。操作日志保留所有变更记录，可在"操作记录"页面查看完整历史。
