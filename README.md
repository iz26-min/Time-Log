# Time Log

个人时间记录 PWA：语音或文字指令 → 确认 → 写入 Google 表格 `TimeLog`。

## 技术栈

- Next.js · TypeScript · Tailwind CSS
- Web Speech API（不支持时自动降级为文字输入）
- Google Apps Script → Google Sheets

## 快速开始

1. 阅读并逐步完成 **[docs/SETUP.md](./docs/SETUP.md)**（Google 表格、Apps Script、Vercel）。
2. 本地开发：

```bash
npm install
cp .env.local.example .env.local
# 编辑 .env.local，填入 NEXT_PUBLIC_SHEETS_API_URL
npm run dev
```

3. 测试解析器：

```bash
npm test
```

## 项目结构

- `src/lib/commandParser.ts` — 中英文确定性指令解析（可替换为 LLM）
- `src/lib/api/sheetsClient.ts` — 调用 Apps Script Web App
- `google-apps-script/Code.gs` — 表格读写 API
- `docs/SETUP.md` — 完整部署说明

## 环境变量

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SHEETS_API_URL` | Apps Script Web App 的 `/exec` URL |

## 许可证

Private / personal use.
