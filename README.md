# ⚔ ChaosZero-Toolkit

**卡俄斯：噩梦 (ChaosZero Nightmare)** — data.pack 解包工具 & 简体中文汉化补丁

---

## 📸 效果预览

![汉化效果](images/image.png)
![游戏内截图](images/screenshot.png)
---

## 🚀 普通用户（一键汉化）

###

- **`ChaosZero-Toolkit.exe`** — 一键汉化工具（无需安装 Python）
- **`text_ko_text.tsv`** — 中文翻译文本库（必须放在 exe 同目录）

### 使用方法

1. 将 `ChaosZero-Toolkit.exe` 和 `text_ko_text.tsv` 放在**同一文件夹**
2. 双击运行 `ChaosZero-Toolkit.exe`
3. 点击 **「🔍 自动寻找」** 自动定位游戏目录（或手动浏览选择）
4. 点击 **「🚀 开始汉化 / 构建封包」**
5. 等待完成后选择 **自动替换** 到游戏目录
6. 进入游戏 → **切换语言/字体** 即可体验中文()

> ⚠ **注意**：繁体中文字体由于游戏热更新机制，每次游戏更新后或者切换语言需要重新打包。韩文版本不受影响。 可以自行选择 

---

## 🛠 开发者（源码使用）

### 环境要求

- Python 3.10+
- `pip install numpy customtkinter`

### 核心文件

| 文件 | 功能 |
|------|------|
| `chaoszero_toolkit_gui.py` | GUI 界面（CustomTkinter） |
| `rebuild_ko_to_zht.py` | 封包核心：提取 → 翻译 → 重建 data.pack |
| `unpack_data.py` | 解包核心：解密 data.pack 并提取全部资源 |
| `text_ko_text.tsv` | 中文翻译文本库 |

### 直接运行

```bash
# GUI 模式
python chaoszero_toolkit_gui.py

# 命令行解包
python unpack_data.py -d "游戏目录/appdata/cznlive" -o ./unpacked

# 命令行解包（仅列出文件）
python unpack_data.py --list

# 命令行解包（按过滤词提取）
python unpack_data.py --filter "text/"
```

---

## 📦 data.pack 技术简介

游戏使用 **PLPcK** 自定义封包格式，包含双层加密：

- **外层 Pack XOR**：129 字节循环密钥（LCG seed=150812）
- **内层 Inner XOR**：256 字节密钥，仅用于 `.db` 文件
- **哈希索引**：CDBM 哈希 → 链表式桶结构
- **多卷分割**：每卷 1GB，跨卷无缝读写

汉化流程：
```
data.pack → 解密 → 提取 text/ko/text.db
→ 解析内层 PLPcK → 应用 TSV 翻译
→ 重建 + 加密 → 写入 text/zht/text.db 位置
→ 流式重建外层 PLPcK + 多卷写出
```

---

## 📝 更新日志

### v1.0 (2026-03-25)
- 初始发布
- 支持 data.pack 全量解包（68,000+ 文件）
- 支持 KO→ZHT 文本替换汉化
- GUI 一键操作 + 自动定位游戏 + 自动替换
- 支持 ZHT 已下载 / 未下载两种模式

---

## 📄 License

MIT License — 自由使用、修改和分发。

---

## 🙏 致谢

- 游戏引擎分析基于 IDA Pro 逆向
- PLPcK 格式参考 Yuna/Cocos2d-x 引擎

> ⭐ 如果这个工具对你有帮助，请给个 Star！
