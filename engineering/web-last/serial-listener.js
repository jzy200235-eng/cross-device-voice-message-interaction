const SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const io = require('socket.io-client');
const { writeCSVData, parseSlidePosition, isDataNormal } = require('./slide-data-logger');

// 配置
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3'; // 可通过环境变量指定，如 COM5
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '115200', 10);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000'; // 可通过环境变量指定
const ENABLE_SERIAL = process.env.ENABLE_SERIAL !== 'false'; // 可通过环境变量禁用
const DATA_RECORD_INTERVAL = 20; // 20ms记录间隔
const TOUCH_END_TIMEOUT_MS = 150; // 触摸结束判定超时（无新数据即视为松手）

// 连接WebSocket服务器
const socket = io(SERVER_URL);

let port = null;
let parser = null;
let lastRecordTime = 0; // 上次记录时间
let lastValidPosition = null; // 上次有效位置
let isRecording = false; // 是否正在记录
let touchEndTimer = null; // 触摸结束计时器

// 串口初始化函数
function initSerial() {
  if (!ENABLE_SERIAL) {
    return;
  }

  try {
    // 创建串口连接 - 优化高频数据处理
    port = new SerialPort.SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false,
      // 优化连续数据处理
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      // 减少缓冲区延迟
      rtscts: false,
      xon: false,
      xoff: false,
      // 提高读取频率
      highWaterMark: 1024
    });

    // 创建行解析器 - 优化连续数据处理
    // 使用更宽松的解析器配置，确保不丢失连续数据
    parser = port.pipe(new ReadlineParser({ 
      delimiter: '\n',
      encoding: 'utf8',
      includeDelimiter: false
    }));
    
    // 不打印原始十六进制数据，保持输出简洁

    // 串口打开事件（静默）
    port.on('open', () => {
      isRecording = true;
    });

    // 串口错误事件（静默）
    port.on('error', () => {
      isRecording = false;
    });

    // 解析接收到的数据 - 优化连续滑动处理
    let lastStatsTime = Date.now();
    
    parser.on('data', (data) => {
      const text = (data || '').toString().trim();
      
      // 打印原始串口输入数据
      console.log('RX:', text);
      
      if (!text) {
        return;
      }
      
      const timestamp = new Date().toISOString();
      const position = parseSlidePosition(text);
      const isNormal = isDataNormal(position);
      const currentTime = Date.now();
      
      // 检查是否需要记录数据（节流记录/低频事件）
      const shouldRecord = currentTime - lastRecordTime >= DATA_RECORD_INTERVAL;

      if (position !== null && !isNaN(position) && position >= 0 && position <= 100) {
        // 任何一次有效数据都立即标记触摸激活，降低交互延迟
        socket.emit('hardware_touch_state', {
          active: true,
          timestamp: currentTime
        });

        // 重置触摸结束计时器：在超时后自动判定为松手
        if (touchEndTimer) clearTimeout(touchEndTimer);
        touchEndTimer = setTimeout(() => {
          socket.emit('hardware_touch_state', {
            active: false,
            timestamp: Date.now()
          });
        }, TOUCH_END_TIMEOUT_MS);

        // 即时向前端推送连续滑动更新（每一帧），用于实时 UI 覆盖
        const prevPos = lastValidPosition;
        socket.emit('continuous_slider_update', {
          position: position,
          timestamp: currentTime,
          source: 'hardware',
          previousPosition: prevPos,
          delta: prevPos !== null ? Math.abs(position - prevPos) : 0
        });
        // 更新上次有效位置（用于 delta 与松手后的最终跳转）
        lastValidPosition = position;

        // 节流：仅在设定间隔内记录CSV并广播低频位置事件
        if (shouldRecord) {
          writeCSVData(timestamp, position.toFixed(2), isNormal);
          lastRecordTime = currentTime;
          console.log(`SP:${position.toFixed(2)}`);

          socket.emit('slider_position', {
            position: position,
            timestamp: currentTime,
            source: 'hardware',
            sender: '硬件传感器',
            messageId: 'hardware_slider',
            isContinuous: true,
            recordInterval: DATA_RECORD_INTERVAL
          });
        }
      }
      
      // 不输出统计信息
    });

    // 尝试打开串口
    port.open(() => {});

  } catch (error) {}
}

// WebSocket连接事件（静默）
socket.on('connect', () => {});
socket.on('disconnect', () => {});

// 错误处理
process.on('SIGINT', () => {
  isRecording = false;
  if (port) {
    port.close();
  }
  if (touchEndTimer) clearTimeout(touchEndTimer);
  socket.disconnect();
  process.exit(0);
});

// 启动串口监听器（静默）
initSerial(); 