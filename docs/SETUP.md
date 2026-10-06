# Time Log — 部署说明（非开发者版）

本应用 = **网页（Vercel）** + **Google 表格（存数据）** + **Apps Script（小后端）**。

按顺序完成下面步骤。任何一步需要你在浏览器里点按钮、授权或复制链接。

---

## 第 1 步：创建 Google 表格

1. 打开 [Google Sheets](https://sheets.google.com)，新建空白表格。
2. 将表格重命名为例如 **Personal Time Log**（名称随意）。
3. 把底部工作表标签改名为 **`TimeLog`**（必须完全一致）。
4. 在第一行填入表头（从 A1 开始，共 9 列）：

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Id | Date | Task | Start At | End At | Duration Minutes | Notes | Created At | Updated At |

5. **暂时不用填数据行**；应用会自动写入。

---

## 第 2 步：添加 Apps Script 代码

1. 在该表格菜单：**扩展程序 → Apps Script**。
2. 若看到默认的 `function myFunction()`，**全选删除**。
3. 打开本仓库里的文件 **`google-apps-script/Code.gs`**，**全部复制**，粘贴到 Apps Script 编辑器。
4. 点击 **保存**（磁盘图标），项目名称可改为 `Time Log API`。

> 脚本通过「当前表格」读写数据，无需单独填写 Spreadsheet ID。

---

## 第 3 步：首次运行并授权 Google 权限

1. 在 Apps Script 顶部函数下拉框选 **`doGet`**（若没有，选任意函数后改回 `doGet`）。
2. 点击 **运行**。
3. Google 会提示 **授权**：
   - 选择你的 Google 账号
   - 若出现「Google 未验证此应用」→ 点 **高级** → **前往 Time Log API（不安全）**（这是你自己的脚本）
   - 允许访问 **Google 表格**
4. 运行成功后，日志里不应有红色错误。

---

## 第 4 步：部署为 Web App（重要）

1. 右上角 **部署 → 新建部署**。
2. 点击「选择类型」→ **Web 应用**。
3. 填写：
   - **说明**：例如 `Time Log v1`
   - **执行身份**：**我**
   - **谁可以访问**：**任何人**（只有知道链接的人才能调用；请勿公开分享链接）
4. 点击 **部署**。
5. 第一次可能再次要求授权，按提示允许。
6. 复制 **Web 应用 URL**，格式类似：  
   `https://script.google.com/macros/s/AKfycb....../exec`  
   **保存到记事本**，下一步要用。

### 以后改代码时

每次修改 `Code.gs` 后：

**部署 → 管理部署 → 铅笔图标 → 版本选「新版本」→ 部署**。

否则线上仍是旧代码。

---

## 第 5 步：本地测试（可选）

1. 安装 [Node.js](https://nodejs.org/)（若尚未安装）。
2. 在项目文件夹打开终端：

```bash
cd ~/Projects/time-tracker
npm install
cp .env.local.example .env.local
```

3. 用文本编辑器打开 `.env.local`，填入：

```env
NEXT_PUBLIC_SHEETS_API_URL=你复制的 Web 应用 URL
```

4. 启动：

```bash
npm run dev
```

5. 浏览器打开 `http://localhost:3000`，在文字框输入 `开始测试`，确认后检查表格是否多了一行。

---

## 第 6 步：部署到 Vercel

1. 将代码推送到 **GitHub**（若还没有仓库，可在 GitHub 新建仓库后按提示 push）。
2. 登录 [Vercel](https://vercel.com)，**Add New → Project**，导入该 GitHub 仓库。
3. 框架会自动识别为 **Next.js**，保持默认即可。
4. 在 **Environment Variables** 添加：

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SHEETS_API_URL` | 你的 Web 应用 URL（`/exec` 结尾） |

5. 点击 **Deploy**，等待完成。
6. 打开 Vercel 给的网址（如 `https://time-tracker-xxx.vercel.app`），再试一次 `开始测试`。

> 修改环境变量后，需要在 Vercel 项目里 **Redeploy** 一次才会生效。

---

## 第 7 步：在 iPhone 上安装（PWA）

1. 用 **Safari** 打开你的 Vercel 网址（不要用微信内置浏览器）。
2. 点底部分享按钮 **分享**。
3. 选择 **添加到主屏幕**。
4. 主屏幕会出现 **Time Log** 图标。

### 语音说明（iPhone）

- Safari **可能**支持语音识别，也可能不支持或不稳定。
- 若麦克风不可用，请直接用 **「或输入指令…」** 文字框。
- 在 iPhone 上：**设置 → Safari → 麦克风**，确保允许。

---

## 第 8 步：支持的指令（v1）

**中文**

- `开始 早餐` / `开始写 NSFC proposal`
- `结束` / `完成`
- `12:15开始 午餐` / `12点15分开始 午餐`
- `记录 午餐 从 12:10 到 13:05`

**英文**

- `Start breakfast` / `Start 写论文`
- `Finish`
- `Start reading at 3:20`
- `Record lunch from 12:10 to 1:05`

时区固定为 **Asia/Hong_Kong**。`Start At` / `End At` 在表格里为完整日期时间。

---

## 常见问题

**网页显示「尚未连接 Google Sheet」**  
→ Vercel 未设置 `NEXT_PUBLIC_SHEETS_API_URL`，或设置后未重新部署。

**保存失败 / 无法解析服务器返回**  
→ Web App 未部署为「任何人」；或 URL 不是 `/exec`；或改代码后未「新版本」部署。

**表格没有 TimeLog 表**  
→ 手动创建名为 `TimeLog` 的工作表并加上表头。

**重复点击确认写了两行**  
→ 应用有 5 秒内防重复；若仍出现，请反馈具体操作步骤。

---

完成以上步骤后，你的日常流程是：

**打开主屏幕 App → 点麦克风或输入指令 → 确认 → 在 Google 表格 TimeLog 中查看记录。**
