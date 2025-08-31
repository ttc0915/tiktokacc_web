# TikTok库存管理系统 - Python数据管理器

这是一个用于管理TikTok账号库存数据的Python工具，可以自动扫描本地数据目录，生成JSON文件，并提供HTTP API接口供前端网站使用。

## 功能特性

- 🔍 **自动数据扫描**: 扫描指定目录结构，解析TikTok账号数据
- 📊 **数据聚合**: 按国家和粉丝区间统计账号数量
- 🌐 **HTTP API服务**: 提供RESTful API接口供前端调用
- 🔄 **实时数据刷新**: 支持手动或自动刷新数据
- ⚙️ **配置化管理**: 通过配置文件自定义各项设置
- 📝 **详细日志**: 记录所有操作和错误信息

## 快速开始

### 1. 环境要求

- Python 3.7+
- 无需额外依赖库（使用Python标准库）

### 2. 目录结构

确保你的数据目录按以下结构组织：

```
粉丝分类/
├── 欧洲/
│   ├── DE/
│   │   ├── 0-500.txt
│   │   ├── 500-1000.txt
│   │   ├── 1000-2000.txt
│   │   └── ...
│   ├── FR/
│   │   ├── 0-500.txt
│   │   └── ...
│   └── ...
├── 东南亚/
│   ├── US/
│   │   ├── 0-500.txt
│   │   └── ...
│   └── ...
└── 中东/
    └── ...
```

### 3. 启动服务

**方法一：双击启动（推荐）**
```bash
# Windows: 双击 启动服务器.py
# 或者命令行运行：
python 启动服务器.py
```

**方法二：命令行启动**
```bash
# 启动完整服务（HTTP API + 数据生成）
python tiktok_data_manager.py

# 只生成JSON文件
python tiktok_data_manager.py --generate-only

# 自定义参数
python tiktok_data_manager.py --data-dir ./粉丝分类 --port 8081
```

### 4. 使用API

服务启动后，可以通过以下接口访问数据：

```bash
# 获取数据
GET http://localhost:8080/api/data

# 刷新数据
GET http://localhost:8080/api/refresh

# 获取服务状态
GET http://localhost:8080/api/status
```

## 配置文件

编辑 `config.json` 自定义设置：

```json
{
  "data_directory": "粉丝分类",
  "output_file": "可视化tiktok账号地球数据/public/data/aggregated.json",
  "server": {
    "port": 8080,
    "auto_start": true,
    "cors_enabled": true
  },
  "file_watcher": {
    "enabled": true,
    "check_interval": 30,
    "auto_refresh": true
  }
}
```

## 数据格式

### 输入数据格式

每个TXT文件包含账号列表，一行一个账号：

```
# 这是注释行，会被忽略
account1
account2
account3
```

### 输出JSON格式

```json
{
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "brackets": ["0-500", "500-1000", ...],
  "totals": {
    "accounts": 12345
  },
  "countries": [
    {
      "code": "US",
      "nameZh": "美国",
      "region": "东南亚",
      "centroid": [-97, 38],
      "byBracket": {
        "0-500": 100,
        "500-1000": 50
      },
      "totals": {
        "accounts": 150
      }
    }
  ],
  "regions": ["欧洲", "东南亚", "中东"]
}
```

## 前端集成

修改前端代码，使其能够从API获取数据：

```javascript
// 获取数据
async function fetchData() {
  try {
    const response = await fetch('http://localhost:8080/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取数据失败:', error);
    // 回退到本地文件
    return await fetch('/data/aggregated.json').then(r => r.json());
  }
}

// 刷新数据
async function refreshData() {
  await fetch('http://localhost:8080/api/refresh');
}
```

## 命令行参数

```bash
python tiktok_data_manager.py [选项]

选项：
  --data-dir, -d       数据目录路径
  --output, -o         输出JSON文件路径
  --port, -p           HTTP服务端口
  --generate-only      只生成JSON文件，不启动服务器
  --no-server          生成文件但不启动服务器
  --help, -h           显示帮助信息
```

## 日志文件

程序运行时会生成 `tiktok_data_manager.log` 日志文件，记录：

- 数据扫描过程
- API请求记录
- 错误和警告信息
- 性能统计

## 故障排除

### 常见问题

**1. 找不到数据目录**
- 确保 `粉丝分类` 目录存在
- 检查 `config.json` 中的路径设置
- 运行启动脚本时会提示创建示例结构

**2. 端口被占用**
- 程序会自动查找可用端口（8080-8179）
- 或在配置文件中指定其他端口

**3. 前端无法获取数据**
- 检查CORS设置
- 确认服务器正在运行
- 查看浏览器控制台错误信息

**4. 数据没有更新**
- 手动调用 `/api/refresh` 接口
- 检查文件权限
- 查看日志文件了解详细错误

### 性能优化

- 大量数据时建议定期清理日志文件
- 可以通过配置文件调整扫描间隔
- 考虑在生产环境中使用专业Web服务器

## 开发和扩展

### 添加新功能

1. 在 `TikTokDataManager` 类中添加方法
2. 在 `TikTokAPIHandler` 中添加新的API端点
3. 更新配置文件支持新选项

### 自定义数据处理

可以修改 `scan_directory` 方法来：
- 支持其他文件格式
- 添加数据验证
- 实现自定义聚合逻辑

## 许可证

此项目为内部工具，仅供参考和学习使用。

## 更新日志

### v1.0.0
- 初始版本
- 基本数据扫描和API功能
- 配置文件支持
- 详细日志记录 