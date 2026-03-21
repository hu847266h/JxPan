[![Stars](https://img.shields.io/github/stars/ByLsPro/JxPan?style=flat-square&logo=github)](https://github.com/ByLsPro/JxPan/stargazers)
[![Forks](https://img.shields.io/github/forks/ByLsPro/JxPan?style=flat-square&logo=github)](https://github.com/ByLsPro/JxPan/network/members)
[![License](https://img.shields.io/github/license/ByLsPro/JxPan?style=flat-square)](https://github.com/ByLsPro/JxPan/blob/main/LICENSE)

## ⭐ 项目热度

[![Stargazers over time](https://starchart.cc/ByLsPro/JxPan.svg?variant=adaptive)](https://starchart.cc/ByLsPro/JxPan)

---

## 📖 项目简介

**JxPan** 是一个基于 Cloudflare Workers 平台的网盘直链解析工具。它能够解析主流网盘分享链接，提取文件真实下载地址，并通过 JSON 格式输出或 302 重定向直接下载，有效绕过网盘客户端限制。

- 🖥️ **Demo 演示站点**：[https://jx.fsapk.xx.kg](https://jx.fsapk.xx.kg)

### ✨ 核心特性

- 🔗 **直链解析**：支持解析网盘分享链接，获取文件真实下载直链
- 📡 **JSON 输出**：标准化 API 响应，方便二次开发集成
- 🔄 **302 重定向**：支持直接重定向到下载地址，实现无缝下载体验
- 🛡️ **边缘计算**：基于 Cloudflare Workers 平台，避免 IP 封禁
- ⚡ **高速稳定**：利用 CF 全球网络，解析速度快、可用性高
- 🌍 **全球访问**：自动选择最优节点，无视地域限制
- 📊 **统计功能**：记录解析次数、成功/失败次数、缓存命中次数

---


## 🚀 支持平台

| 平台 | 域名 | 状态 |
|------|------|------|
| 阿里云盘 | alipan.com / aliyundrive.com | ✅ 已支持 |
| 夸克网盘 | pan.quark.cn | ✅ 已支持 |
| UC网盘 | drive.uc.cn / fast.uc.cn | ✅ 已支持 |
| 移动云盘 | yun.139.com / caiyun.139.com | ✅ 已支持 |
| 小飞机网盘 | feijipan.com | ✅ 已支持 |
| 蓝奏云优享版 | ilanzou.com | ✅ 已支持 |
| 蓝奏云 | lanzou*.com | ✅ 已支持 |

> **注意**：阿里云盘、夸克网盘、UC网盘、移动云盘需要配置认证信息才能正常解析
---

## 💡 快速部署

### ⚙️ Workers 部署

#### 1. 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)，进入 **Workers & Pages**
2. 点击 "创建服务"，输入服务名称（如 `jxpan`），点击 "创建服务"

#### 2. 上传代码

1. 进入 Worker 编辑页面，点击 "快速编辑"
2. 将 `_worker.js` 的完整代码粘贴到编辑器中
3. 点击 "保存并部署"

#### 3. 配置环境变量（可选）

对于需要认证的网盘，需要配置以下环境变量：

| 变量名 | 说明 | 适用平台 |
|--------|------|----------|
| `ALIYUN_AUTHORIZATION` | 阿里云盘的 Authorization Token | 阿里云盘 |
| `QK_COOKIE` | 夸克网盘的 Cookie | 夸克网盘 |
| `UC_COOKIE` | UC网盘的 Cookie | UC网盘 |
| `MCLOUD_AUTHORIZATION` | 移动云盘的 Authorization Token | 移动云盘 |

配置方法：
1. 在 Worker 页面点击 "设置" → "变量"
2. 点击 "添加变量"，输入变量名和值
3. 点击 "保存"

#### 4. 配置 KV 存储（推荐）

为了启用缓存机制和统计功能，需要配置 KV 存储：

0. 在 Cloudflare Dashboard 中，进入 "储存与数据库" → "Workers KV"
1. 进入界面后在右上角“创建实例”，并输入"JxPan"作为命名空间名称
2. 在 Cloudflare Dashboard 中，进入 "Workers & Pages" → "KV"
3. 点击 "创建命名空间"，输入名称（如 `JxPan`）
4. 回到 Worker 页面，点击 "设置" → "KV 命名空间绑定"
5. 点击 "添加绑定"
6. 变量名称填写 `JxPan`，选择刚刚创建的 KV 命名空间
7. 点击 "添加绑定"

#### 5. 绑定自定义域（推荐）

1. 在 "触发器" 选项卡点击 "添加自定义域"
2. 输入您的域名（如 `pan.yourdomain.com`），点击 "添加自定义域"
3. 按提示完成 DNS 解析，等待证书生效

#### 6. 访问测试

- 访问 `https://your-domain.com/` 查看使用说明
- 访问 `https://your-domain.com/?url=分享链接` 进行解析测试

---

## 📚 API 使用文档

### 基础接口

#### 1. 解析接口（JSON 返回）

```
GET /?url={分享链接}&pwd={密码}&type=json
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | ✅ | 网盘分享链接 |
| pwd | string | ❌ | 分享密码（如有） |
| type | string | ❌ | 返回类型 |

**返回示例：**

```json
{
  "code": 200,
  "msg": "解析成功",
  "success": true,
  "shareKey": "uc:xxxxxxxx",
  "cookie_status": {
    "valid": true,
    "remaining_time": "1小时30分",
    "remaining_seconds": 5400
  },
  "data": {
    "file_id": "xxxxxxxx",
    "file_name": "example.zip",
    "file_size": "100.00 MB",
    "download_url": "https://..."
  }
}
```

#### 2. 302 自动跳转下载

```
GET /?url={分享链接}&pwd={密码}
```

默认情况下，对于支持直接下载的网盘会使用 302 重定向到下载地址。

#### 3. 代理下载（适用于阿里云盘、夸克网盘、UC网盘、移动云盘）

```
GET /?url={分享链接}&pwd={密码}&type=down
```

**说明：**
- 对于阿里云盘、夸克网盘、UC网盘、移动云盘等需要特殊请求头的网盘
- 代理下载会携带必要的请求头（如：Cookie、Referer、X-CToken、Authorization 等）

#### 4. 获取统计数据

```
GET /?action=get_stats
```

**返回示例：**

```json
{
  "code": 200,
  "msg": "获取统计数据成功",
  "success": true,
  "data": {
    "total": 100,
    "success": 95,
    "failed": 5,
    "cached": 80
  }
}
```

**字段说明：**
- `total`：解析总数
- `success`：成功次数
- `failed`：失败次数
- `cached`：缓存命中次数

---

## ⚙️ 配置说明

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ALIYUN_ENABLED` | true | 是否启用阿里云盘解析 |
| `ALIYUN_AUTHORIZATION` | - | 阿里云盘 Authorization Token |
| `ALIYUN_USER_AGENT` | - | 阿里云盘自定义 UA |
| `QK_ENABLED` | true | 是否启用夸克网盘解析 |
| `QK_COOKIE` | - | 夸克网盘 Cookie |
| `QK_USER_AGENT` | - | 夸克网盘自定义 UA |
| `UC_ENABLED` | true | 是否启用 UC 网盘解析 |
| `UC_COOKIE` | - | UC 网盘 Cookie |
| `UC_USER_AGENT` | - | UC 网盘自定义 UA |
| `MCLOUD_ENABLED` | true | 是否启用移动云盘解析 |
| `MCLOUD_AUTHORIZATION` | - | 移动云盘 Authorization Token |
| `MCLOUD_USER_AGENT` | - | 移动云盘自定义 UA |
| `AUTO_SWITCH` | true | 自动切换平台 UA |
| `MODE` | pc | 解析模式 |
| `REDIRECT_URL` | false | 是否默认使用 302 重定向 |

### KV 存储配置

| 绑定名称 | 说明 | 必需 |
|----------|------|------|
| `JxPan` | KV 命名空间绑定，用于存储缓存和统计数据 | 推荐 |

### 认证信息获取方法

#### 阿里云盘

1. 访问 https://www.alipan.com 并登录
2. 按 F12 打开开发者工具 → Network
3. 刷新页面，找到任意 API 请求
4. 复制请求头中的 `Authorization` 字段值（包含 Bearer）

#### 夸克网盘

1. 访问 https://pan.quark.cn 并登录
2. 按 F12 打开开发者工具 → Network
3. 刷新页面，找到任意 API 请求
4. 复制请求头中的 `Cookie` 字段值

#### UC网盘

1. 访问 https://drive.uc.cn 并登录
2. 访问任意分享链接
3. 按 F12 打开开发者工具 → Network
4. 找到 `share/sharepage/token` 或 `transfer_share/detail` 请求
5. 复制请求头中的完整 `Cookie` 字符串

**UC网盘 Cookie 必须包含以下字段：**
- `__pus`
- `__puus`
- `UDRIVE_TRANSFER_SESS`
- `ctoken`（必需，用于 X-CToken 请求头）
- `b-user-id`

#### 移动云盘

1. 访问 https://yun.139.com 并登录
2. 按 F12 打开开发者工具 → Network
3. 刷新页面，找到任意 API 请求
4. 复制请求头中的 `Authorization` 字段值（包含 Basic）

---

## 📝 使用示例

### 阿里云盘

```bash
# JSON 返回
curl "https://your-domain.com/?url=https://www.alipan.com/s/xxxxxx&type=json"

# 代理下载
curl "https://your-domain.com/?url=https://www.alipan.com/s/xxxxxx&type=down"
```

### 夸克网盘

```bash
# JSON 返回
curl "https://your-domain.com/?url=https://pan.quark.cn/s/xxxxxx&type=json"

# 代理下载
curl "https://your-domain.com/?url=https://pan.quark.cn/s/xxxxxx&type=down"
```

### UC网盘

```bash
# JSON 返回
curl "https://your-domain.com/?url=https://drive.uc.cn/s/xxxxxx&type=json"

# 代理下载
curl "https://your-domain.com/?url=https://drive.uc.cn/s/xxxxxx&type=down"
```

### 移动云盘

```bash
# JSON 返回
curl "https://your-domain.com/?url=https://yun.139.com/shareweb/#/w/i/xxxxxx&type=json"

# 代理下载
curl "https://your-domain.com/?url=https://yun.139.com/shareweb/#/w/i/xxxxxx&type=down"
```

### 蓝奏云

```bash
# 直接下载（支持 302 重定向）
curl "https://your-domain.com/?url=https://lanzoux.com/xxxxxx"
```

---

## 🔧 技术架构

```
┌─────────────────┐
│   Cloudflare    │
│    Workers      │
│  (Edge Runtime) │
└────────┬────────┘
         │
    ┌────┼───────┐
    │    │       │
┌───▼───┐│  ┌────▼────┐
│ 网盘  ││  │ Cloudflare │
│ API   ││  │    KV     │
└───────┘│  └──────────┘
         │
    ┌────▼────┐
    │ 网盘 OSS │
    └─────────┘
```

### 核心模块

- **CookieManager** - Cookie 缓存管理，支持 2 小时有效期
- **AliyunPanParser** - 阿里云盘解析器
- **QuarkParser** - 夸克网盘解析器
- **UCParser** - UC网盘解析器
- **MobileCloudParser** - 移动云盘解析器
- **FeijipanParser** - 小飞机网盘解析器
- **IlanzouParser** - 蓝奏云优享版解析器
- **LanzouParser** - 蓝奏云解析器
- **KV Storage** - 使用 Cloudflare KV 存储缓存和统计数据
- **Cache Mechanism** - 缓存解析结果，提高响应速度
- **Statistics** - 记录和提供解析统计数据

---

## ⚠️ 免责声明

本项目仅供学习研究使用，旨在探索网盘分享链接的解析原理及边缘计算技术应用。

使用本项目获取的下载链接，请严格遵守各网盘平台的服务条款及相关法律法规。

**严禁将本项目用于以下行为：**

- 大规模自动化爬取、转存或分发网盘资源
- 破解、绕过网盘平台的付费功能或访问限制
- 传播盗版、侵权或违法违规内容

作者不对因使用本项目导致的任何法律纠纷、账号封禁或数据损失承担责任。

如因网盘平台政策调整或反爬升级导致功能失效，本项目可能随时停止维护，敬请谅解。

下载的文件请在 24 小时内删除，不得用于商业用途或二次传播。

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 提交新平台支持

如果你想添加新的网盘支持，请确保：

1. 实现对应的 Parser 类
2. 遵循现有的代码风格
3. 提供完整的测试用例
4. 更新 README.md 文档

---

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：

- GitHub Issues: [提交问题](https://github.com/ByLsPro/JxPan/issues)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ByLsPro">ByLsPro</a>
</p>
