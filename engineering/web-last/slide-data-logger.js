const SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');
const path = require('path');

// 配置
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '115200', 10);
const CSV_DIR = path.join(__dirname, 'slide_data_csv');
const DATA_RECORD_INTERVAL = 50; // 50ms记录间隔

// 确保CSV目录存在
if (!fs.existsSync(CSV_DIR)) {
  fs.mkdirSync(CSV_DIR, { recursive: true });
}

// 生成CSV文件名（按日期）
function getCSVFileName() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(CSV_DIR, `slide_data_${dateStr}.csv`);
}

// 写入CSV数据 - 优化高频写入性能
function writeCSVData(timestamp, percentage, isNormal) {
  const csvFile = getCSVFileName();
  const csvLine = `${timestamp},${percentage},${isNormal ? '正常' : '异常'}\n`;
  
  // 如果文件不存在，先写入表头
  if (!fs.existsSync(csvFile)) {
    const header = '时间,百分比SP,是否正常\n';
    fs.writeFileSync(csvFile, header, 'utf8');
  }
  
  // 追加数据 - 使用同步写入确保数据完整性
  try {
    fs.appendFileSync(csvFile, csvLine, 'utf8');
  } catch (error) {
    console.error('❌ CSV写入失败:', error.message);
  }
}

// 解析滑动位置数据
function parseSlidePosition(text) {
  if (!text) return null;
  
  const lower = text.toLowerCase().trim();
  let position = null;

  // 1) 兼容 SP:xx.x / sp:xx.x
  if (lower.startsWith('sp:')) {
    const positionStr = lower.substring(3).trim();
    const p = parseFloat(positionStr);
    if (!isNaN(p)) position = p;
  }

  // 1.1) 兼容 "SP xx.x%" / "sp xx.x%"（冒号变空格、可带%）
  if (position === null) {
    const mSpace = lower.match(/^sp\s+([-+]?\d+(?:\.\d+)?)\s*%?/);
    if (mSpace) {
      position = parseFloat(mSpace[1]);
    }
  }

  // 2) 兼容 "Slide Position: 100.00%"
  if (position === null) {
    const m = lower.match(/slide\s*positio<LOCAL_PATH>
    if (m) {
      position = parseFloat(m[1]);
    }
  }

  // 3) 兼容纯百分数字符串，如 "100.00%" 或 "100"
  if (position === null) {
    const m2 = lower.match(/^\s*([-+]?\d+(?:\.\d+)?)\s*%?\s*$/);
    if (m2) {
      position = parseFloat(m2[1]);
    }
  }

  return position;
}

// 判断数据是否正常
function isDataNormal(position) {
  if (position === null || isNaN(position)) return false;
  return position >= 0 && position <= 100;
}

// 主函数
async function startSlideDataLogger() {
  console.log('🚀 启动滑动数据记录器...');
  console.log('⚙️ 配置:', { SERIAL_PORT, BAUD_RATE, DATA_RECORD_INTERVAL });
  console.log('📁 CSV文件保存目录:', CSV_DIR);
  console.log('📊 记录格式: 时间,百分比SP,是否正常');
  console.log(`⏱️ 记录间隔: ${DATA_RECORD_INTERVAL}ms`);
  
  try {
    // 创建串口连接
    const port = new SerialPort.SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false
    });

    // 创建行解析器
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    // 串口打开事件
    port.on('open', () => {
      console.log('✅ 串口连接成功:', SERIAL_PORT);
      console.log('📝 开始记录滑动数据...');
      console.log(`📊 数据记录间隔: ${DATA_RECORD_INTERVAL}ms`);
      console.log('💡 按 Ctrl+C 停止记录');
    });

    // 串口错误事件
    port.on('error', (err) => {
      console.error('❌ 串口错误:', err.message);
      console.log('💡 请检查串口配置和连接');
    });

    // 解析接收到的数据
    let lastRecordTime = 0; // 上次记录时间
    let totalRecords = 0; // 总记录数
    let validRecords = 0; // 有效记录数
    
    parser.on('data', (data) => {
      const text = (data || '').toString().trim();
      if (!text) return;
      
      const timestamp = new Date().toISOString();
      const position = parseSlidePosition(text);
      const isNormal = isDataNormal(position);
      const currentTime = Date.now();
      
      // 检查是否需要记录数据（50ms间隔）
      const shouldRecord = currentTime - lastRecordTime >= DATA_RECORD_INTERVAL;
      
      if (shouldRecord && position !== null && !isNaN(position) && position >= 0 && position <= 100) {
        // 记录到CSV
        writeCSVData(timestamp, position.toFixed(2), isNormal);
        lastRecordTime = currentTime;
        totalRecords++;
        
        if (isNormal) validRecords++;
        
        // 控制台输出 - 优化显示格式
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        console.log(`📊 [${timeStr}] 位置: ${position.toFixed(2)}% ${isNormal ? '✅ 正常' : '❌ 异常'} (记录#${totalRecords})`);
      } else if (position !== null) {
        console.log(`📊 [${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] 原始数据: "${text}" ❌ 无法解析`);
      }
      
      // 每100条记录输出一次统计
      if (totalRecords > 0 && totalRecords % 100 === 0) {
        console.log(`📈 记录统计: 总记录=${totalRecords}, 有效记录=${validRecords}, 有效率=${((validRecords/totalRecords)*100).toFixed(1)}%`);
      }
    });

    // 尝试打开串口
    port.open((err) => {
      if (err) {
        console.error('❌ 无法打开串口:', err.message);
        console.log('💡 请检查:');
        console.log('1. 串口设备是否正确连接');
        console.log('2. 串口号是否正确 (当前:', SERIAL_PORT, ')');
        console.log('3. 波特率是否匹配 (当前:', BAUD_RATE, ')');
        console.log('4. 是否有其他程序占用串口');
        
        // 列出可用的串口
        SerialPort.SerialPort.list().then((ports) => {
          console.log('📋 可用的串口:');
          ports.forEach((port) => {
            console.log('-', port.path, ':', port.manufacturer || 'Unknown');
          });
        });
        
        process.exit(1);
      }
    });

    // 优雅关闭
    process.on('SIGINT', () => {
      console.log('\n🔄 正在关闭串口连接...');
      console.log(`📊 最终统计: 总记录=${totalRecords}, 有效记录=${validRecords}`);
      port.close(() => {
        console.log('✅ 滑动数据记录器已停止');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  startSlideDataLogger();
}

module.exports = {
  startSlideDataLogger,
  parseSlidePosition,
  isDataNormal,
  writeCSVData
};
