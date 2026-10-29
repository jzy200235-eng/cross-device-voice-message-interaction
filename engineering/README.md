# 1.0主链路源码

保留原工程目录关系，整理网页播放器、Node服务、串口监听及Python分段摘要入口。排除账号、会话、研究录音、日志、模型、依赖缓存和硬编码密钥。没有新增硬件固件或PCB设计文件。

## 网页与本地服务

需要Node.js（本次使用22.15.1）。分别安装后端与前端依赖：

```bash
cd web-last
npm install
cd client
npm install
npm run build
cd ..
npm run server
```

服务默认5000端口，前端配置同为5000。本仓库服务默认绑定127.0.0.1，用于本机演示；真实手机接入需要自行配置局域网地址及网络访问。原工程为研究工具，非生产部署服务。

未附带账号与录音，启动后需要建立自己的演示账号，并使用已获许可的输入。独立网页体验可直接使用仓库`site/demo`中的合成示例，不依赖这个服务。

## AI处理

```bash
cd Voice_Summary_Project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements_api.txt
```

在运行环境设置`OPENAI_API_KEY`和`OPENAI_BASE_URL`。不要提交实际密钥。准备自行获准使用的输入音频及本机音频解码条件，再运行：

```bash
python segment_pipeline.py --audio_path /path/to/your/audio.wav --compact
```

主入口默认使用Whisper识别接口和gpt-4o-mini摘要，实际模型可用性取决于账号、服务与入口配置。依赖包含原工程的可选模块，并未对新机器完整安装或在线调用作保证。主入口输出总摘要和时间对齐分段JSON；音频合成／拼接需要结合`web-last`中的音频处理脚本，不能把JSON输出等同于完整音频成品。

## 硬件接入

先运行Node服务，再按实际串口设置变量启动桥接：

```bash
cd web-last
SERIAL_PORT=/dev/your-serial-port BAUD_RATE=115200 SERVER_URL=http://localhost:5000 npm run serial
```

串口监听接收0–100%位置、经Socket.IO广播触摸与滑动状态；网页处理正在播放的消息。耳机音频由操作系统蓝牙音频路由。没有固件、PCB和校准文件时，无法仅靠本仓库重建实体硬件。

完整AI与硬件链路没有在此次整理中端到端复现。已有验证是原网页构建、基础后端接口及合成参照播放器操作。第三方依赖保留其各自许可；本项目未另附开源许可证。
