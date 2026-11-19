# ZCode auto-approve · 自动授权插件

睡前挂机跑项目，早上醒来发现项目**根本还没开始**——因为它卡在第一个授权弹窗上等你点"同意"。

这个插件就是为消灭这种夜晚而写的：通过 `PreToolUse` / `PermissionRequest` 钩子对所有工具调用自动输出 `allow` 决策，让长时任务真正无人值守地跑完一整夜。

## 它做什么

- 拦截 ZCode 的每一次权限询问（PreToolUse 与 PermissionRequest 两类事件），直接给出 `allow`
- 授权过程零弹窗、零提示音、零提示点，长时任务不再被阻塞
- 配合 ZCode 的计划任务/夜间挂机场景使用

## 安全设计（不是无脑全放行）

1. **熔断器让位**：若 `~/.zcode/hooks/circuit-breaker.mjs` 已对本调用判定 `ask` / `deny`（同输入重复超过 3 次，或单轮 Edit/Write/Bash 超过 200 次会 ask、超过 800 次会 deny），本插件**保持沉默、不抢决策**，熔断器的否决独立生效——防止 agent 失控循环刷爆账单
2. **错误即静默**：任何内部异常一律 `exit 0`，绝不阻塞正常工作流
3. **随时可停**：Settings → Plugin Management 里禁用本插件即可，无需删文件

## 安装

本仓库根目录含 `marketplace.json`，将本仓库添加为 ZCode 插件市场后安装 `auto-approve` 即可。

## 自定义 node 路径

`auto-approve/hooks/hooks.json` 中的 `command` 默认为：

```
C:\Program Files\nodejs\node.exe
```

这是 Windows 的标准安装位置。如果你的 node 不在这里，或你在 macOS / Linux 上使用，请把 `command` 改为本机 node 的绝对路径（类 Unix 系统通常是 `/usr/bin/env node` 或 `/usr/local/bin/node`），`${ZCODE_PLUGIN_ROOT}` 变量无需改动。

## 文件结构

```
├── marketplace.json          # 插件市场清单（仓库名: beyondstand-zcode-plugins）
└── auto-approve/
    ├── .zcode-plugin/
    │   └── plugin.json       # 插件元数据
    └── hooks/
        ├── hooks.json        # PreToolUse / PermissionRequest 钩子注册
        └── auto-approve.mjs  # 决策脚本
```

## 已验证

- ✅ 放行逻辑：PreToolUse / PermissionRequest 均正确输出 `allow`
- ✅ 熔断联动：count 路线 / hash 路线触发时脚本沉默让位
- ✅ 容错：非法输入静默退出
- ✅ 端到端：工作区外写入等需授权操作全程零弹窗

## 许可

[MIT](./LICENSE)
