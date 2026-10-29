const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入数据库模块和摘要服务
const Database = require('./database');
const SummarizationService = require('./summarization');
// 升级：使用高级存储/会话管理（保持事件链路不变）
const SlideDataManager = require('./advancedSlideData');
const UserBehaviorLogger = require('./userBehaviorLogger');

// 将Python segments转换为前端期望的格式
function convertSegmentsToFrontendFormat(segments, totalDuration) {
  if (!segments || segments.length === 0) return [];
  
  const frontendSegments = [];
  
  // Part 1: 总摘要
  frontendSegments.push({
    part: 1,
    type: 'summary',
    start_time: 0,
    end_time: Math.min(5, totalDuration * 0.1), // 前10%或5秒
    duration: Math.min(5, totalDuration * 0.1),
    description: '总摘要'
  });
  
  // Part 2-4: 分摘要和原文
  segments.forEach((segment, index) => {
    const partNumber = index + 2; // 从2开始
    if (partNumber > 4) return; // 最多4个部分
    
    // 解析时间范围 (格式: "00:00-00:15")
    const timeMatch = segment.time_range?.match(/(\d+):(\d+)-(\d+):(\d+)/);
    let startTime = 0, endTime = 0;
    
    if (timeMatch) {
      startTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      endTime = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
    } else {
      // 如果没有时间范围，按比例分配
      const segmentDuration = totalDuration / segments.length;
      startTime = index * segmentDuration;
      endTime = (index + 1) * segmentDuration;
    }
    
    // 分摘要
    frontendSegments.push({
      part: partNumber,
      type: 'summary_tts',
      start_time: startTime,
      end_time: startTime + (endTime - startTime) * 0.5, // 前半段
      duration: (endTime - startTime) * 0.5,
      description: segment.segment_summary || ''
    });
    
    // 原文
    frontendSegments.push({
      part: partNumber,
      type: 'original_audio',
      start_time: startTime + (endTime - startTime) * 0.5, // 后半段
      end_time: endTime,
      duration: (endTime - startTime) * 0.5,
      description: segment.original_fragment || ''
    });
  });
  
  return frontendSegments;
}

const app = express();
const server = http.createServer(app);
// 允许所有IP访问Socket.IO（开发环境）
const io = socketIo(server, {
  cors: {
    origin: "*", // 允许所有来源访问
    methods: ["GET", "POST"],
    credentials: false
  }
});

// 中间件 - 允许所有来源访问API
app.use(cors({
  origin: "*", // 允许所有来源访问
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client/build')));

// 静态文件服务 - 用于提供音频文件
app.use('/audio', express.static(path.join(__dirname, '../combined_audio')));

// ====== 服务器音频文件选择与处理 ======
const ROOT_MAP = {
  combined_audio: path.resolve(__dirname, '../combined_audio'),
  data: path.resolve(__dirname, '../data'),
  voice_data: path.resolve(__dirname, '../../Voice_Summary_Project/data')
};

function isAllowedExtension(file) {
  const lower = file.toLowerCase();
  return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a');
}

function safeJoin(rootKey, relativePath = '') {
  const base = ROOT_MAP[rootKey];
  if (!base) return null;
  const safeRel = (relativePath || '').replace(/\\/g, '/');
  if (safeRel.includes('..')) return null;
  const abs = path.resolve(base, '.' + path.sep + safeRel);
  if (!abs.startsWith(base)) return null; // 防穿越
  return abs;
}

// 列出音频文件（支持子目录）
app.get('/api/audio-files', (req, res) => {
  try {
    const rootKey = (req.query.root || '').trim();
    const subdir = (req.query.subdir || '').trim();
    const base = ROOT_MAP[rootKey];
    if (!base) return res.status(400).json({ error: 'invalid root' });

    const target = safeJoin(rootKey, subdir || '');
    if (!target) return res.status(400).json({ error: 'invalid subdir' });
    if (!fs.existsSync(target)) return res.json({ path: subdir || '', items: [] });

    const entries = fs.readdirSync(target, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      relPath: path.posix.join(subdir || '', e.name),
      isAudio: !e.isDirectory() && isAllowedExtension(e.name)
    }));
    res.json({ path: subdir || '', items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 按路径处理音频
app.post('/api/summarize/voice-by-path', async (req, res) => {
  try {
    const { root, relativePath } = req.body || {};
    if (!root || !relativePath) return res.status(400).json({ error: 'missing params' });

    const abs = safeJoin(root, relativePath);
    if (!abs) return res.status(400).json({ error: 'invalid path' });
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'file not found' });
    if (!isAllowedExtension(abs)) return res.status(400).json({ error: 'unsupported file type' });

    const result = await summarizationService.processVoiceFile(abs);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 数据库实例和摘要服务实例
const db = new Database();
const summarizationService = new SummarizationService();
const slideDataManager = new SlideDataManager();
const userBehaviorLogger = new UserBehaviorLogger();

// 从 Express 请求推断客户端 IP（与 Socket 版本保持一致）
function getClientIPFromReq(req) {
  const ipSources = [
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['x-client-ip'],
    req.ip,
    req.connection?.remoteAddress,
    req.socket?.remoteAddress,
    req.connection?.socket?.remoteAddress
  ];
  for (const ip of ipSources) {
    if (ip && ip !== 'unknown') {
      if (typeof ip === 'string' && ip.startsWith('::ffff:')) return ip.substring(7);
      if (ip === '::1' || ip === 'localhost') return '127.0.0.1';
      return ip;
    }
  }
  return '127.0.0.1';
}

// 全局状态管理 - 跟踪每个IP的当前播放状态
const globalPlaybackState = new Map(); // IP -> { messageId, sender, isPlaying }

// 获取客户端IP地址
function getClientIP(socket) {
  // 按优先级获取IP地址
  const ipSources = [
    socket.handshake.headers['x-forwarded-for'],
    socket.handshake.headers['x-real-ip'],
    socket.handshake.headers['x-client-ip'],
    socket.handshake.headers['cf-connecting-ip'], // Cloudflare
    socket.handshake.address,
    socket.conn?.remoteAddress,
    socket.request?.connection?.remoteAddress,
    socket.request?.socket?.remoteAddress
  ];

  // 获取第一个有效的IP地址
  for (const ip of ipSources) {
    if (ip && ip !== 'unknown') {
      // 处理IPv6映射的IPv4地址
      if (ip.startsWith('::ffff:')) {
        return ip.substring(7); // 移除 ::ffff: 前缀
      }
      // 处理本地开发环境的特殊IP
      if (ip === '::1' || ip === 'localhost') {
        return '127.0.0.1'; // 转换为标准本地IP
      }
      return ip;
    }
  }

  // 如果都获取不到，使用标准本地IP
  const fallbackIP = '127.0.0.1';
  console.log('⚠️ 使用标准本地IP地址:', fallbackIP);
  return fallbackIP;
}

// 更新全局播放状态
function updatePlaybackState(ip, messageId, sender, isPlaying) {
  if (isPlaying) {
    globalPlaybackState.set(ip, { messageId, sender, isPlaying });
  } else {
    globalPlaybackState.delete(ip);
  }
  console.log('📊 更新播放状态:', ip, { messageId, sender, isPlaying });
}

// 获取当前播放信息
function getCurrentPlaybackInfo(ip) {
  const state = globalPlaybackState.get(ip);
  return state || { messageId: 'unknown_message', sender: '未知发送者' };
}

// WebSocket连接处理
io.on('connection', (socket) => {
  const clientIP = getClientIP(socket);
  console.log('用户连接:', socket.id, 'IP:', clientIP);
  
  // 添加详细的IP地址调试信息
  console.log('🔍 IP地址调试信息:');
  console.log('  socket.handshake.address:', socket.handshake.address);
  console.log('  socket.handshake.headers.x-forwarded-for:', socket.handshake.headers['x-forwarded-for']);
  console.log('  socket.handshake.headers.x-real-ip:', socket.handshake.headers['x-real-ip']);
  console.log('  socket.handshake.headers.x-client-ip:', socket.handshake.headers['x-client-ip']);
  console.log('  socket.conn?.remoteAddress:', socket.conn?.remoteAddress);
  console.log('  socket.request?.connection?.remoteAddress:', socket.request?.connection?.remoteAddress);
  console.log('  socket.request?.socket?.remoteAddress:', socket.request?.socket?.remoteAddress);
  console.log('  最终使用的IP:', clientIP);

  // 处理滑动位置数据（来自串口监听器或网页端）
  socket.on('slider_position', (data) => {
    console.log('收到滑动位置:', data.position + '%', '来源:', data.source || 'unknown');
    console.log('滑动数据详情:', {
      sender: data.sender,
      messageId: data.messageId,
      position: data.position,
      source: data.source,
      isContinuous: data.isContinuous || false,
      recordInterval: data.recordInterval || 'N/A'
    });
    
    // 记录滑动数据到 0902 风格的存储（不影响广播）
    if (data.position !== undefined && data.position !== null) {
      slideDataManager.recordPosition(clientIP, data.source || 'hardware_sensor', data.position);
    } else {
      console.warn('⚠️ 滑动位置数据无效:', data);
    }
    
    // 广播保持 0828 行为：原样转发
    io.emit('slider_position_update', {
      position: data.position,
      timestamp: data.timestamp,
      source: data.source,
      isContinuous: data.isContinuous || false,
      recordInterval: data.recordInterval || 'N/A'
    });
  });

  // 调试：前端上报的TTS播报/命中事件
  socket.on('tts_debug', (data) => {
    try {
      console.log('[TTS_DEBUG]', {
        kind: data?.kind,
        mode: data?.mode,
        source: data?.source,
        part: data?.part,
        positionPct: data?.positionPct,
        messageId: data?.messageId,
        ts: new Date(data?.timestamp || Date.now()).toLocaleTimeString('zh-CN', { hour12: false })
      });
    } catch (e) {
      console.log('[TTS_DEBUG] malformed payload', data);
    }
  });

  // 硬件触摸状态：active=true 表示按住；false 表示松手
  socket.on('hardware_touch_state', (data) => {
    io.emit('hardware_touch_state', {
      active: !!data.active,
      timestamp: data.timestamp || Date.now()
    });
  });

  // 处理连续滑动更新事件
  socket.on('continuous_slider_update', (data) => {
    console.log('收到连续滑动更新:', data.position + '%', '变化量:', data.delta.toFixed(2) + '%');
    console.log('连续滑动详情:', {
      position: data.position,
      previousPosition: data.previousPosition,
      delta: data.delta,
      source: data.source,
      timestamp: data.timestamp
    });
    
    // 集成用户行为记录 - 记录硬件滑动数据
    if (socket.userId) {
      console.log(`🔍 尝试记录硬件滑动数据: IP=${clientIP}, userId=${socket.userId}`);
      userBehaviorLogger.logSlideData(clientIP, data.position, '硬件');
    } else {
      console.log(`⚠️ 无法记录硬件滑动数据: 用户未登录 (IP=${clientIP})`);
    }
    
    // 广播连续滑动更新给所有客户端
    io.emit('continuous_slider_update', {
      position: data.position,
      timestamp: data.timestamp,
      source: data.source || 'hardware',
      previousPosition: data.previousPosition,
      delta: data.delta
    });
  });

  // 处理网页端进度条控制
  socket.on('web_progress_control', (data) => {
    console.log('收到网页端进度控制:', data.position + '%');
    console.log('网页端数据详情:', {
      sender: data.sender,
      messageId: data.messageId,
      position: data.position
    });
    
    // 记录滑动数据到 0902 风格的存储（按 clientType 分类）
    if (data.position !== undefined && data.position !== null) {
      const clientType = data.clientType === 'mobile' ? 'mobile_web' : 'desktop_web';
      slideDataManager.recordPosition(clientIP, clientType, data.position);
    } else {
      console.warn('⚠️ 网页端进度数据无效:', data);
    }
    
    // 广播保持 0828 行为：原样转发
    io.emit('slider_position_update', {
      position: data.position,
      timestamp: data.timestamp,
      source: data.clientType === 'mobile' ? 'mobile_web' : 'desktop_web'
    });
  });

  // 会话/实验/时间戳 API（0902风格），不影响控制链路
  app.post('/api/slide-data/user/start', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { source, userName } = req.body;
      console.log('🚀 API收到用户开始请求 - IP:', ip, '数据源:', source, '用户名:', userName);
      if (!source || !userName) {
        console.log('❌ 缺少必要参数 - source:', source, 'userName:', userName);
        return res.status(400).json({ error: '缺少必要参数: source, userName' });
      }
      const result = slideDataManager.startUserSession(ip, source, userName);
      console.log('🚀 会话创建结果:', result);
      if (result.success) {
        console.log('✅ 会话创建成功，返回响应');
        return res.json({ success: true, sessionId: result.sessionId, userFolderPath: result.userFolderPath });
      }
      console.log('❌ 会话创建失败:', result.error);
      return res.status(500).json({ error: result.error || '用户会话开始失败' });
    } catch (e) { 
      console.error('❌ 服务器内部错误:', e);
      return res.status(500).json({ error: '服务器内部错误' }); 
    }
  });

  app.post('/api/slide-data/user/end', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { source } = req.body;
      if (!source) return res.status(400).json({ error: '缺少必要参数: source' });
      const result = slideDataManager.endUserSession(ip, source);
      if (result.success) return res.json({ success: true });
      return res.status(500).json({ error: result.error || '用户会话结束失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  app.post('/api/slide-data/experiment/start', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { source, experimentName } = req.body;
      if (!source || !experimentName) return res.status(400).json({ error: '缺少必要参数: source, experimentName' });
      const result = slideDataManager.startExperiment(ip, source, experimentName);
      if (result.success) return res.json({ success: true, experimentId: result.experimentId, experimentFolderPath: result.experimentFolderPath });
      return res.status(500).json({ error: result.error || '实验开始失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  app.post('/api/slide-data/experiment/end', async (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { source } = req.body;
      if (!source) return res.status(400).json({ error: '缺少必要参数: source' });
      const result = slideDataManager.endExperiment(ip, source);
      if (result.success && result.experimentFolderPath && result.startTimeIso) {
        try {
          await slideDataManager.copyGeneralToExperiment(ip, source, result.experimentFolderPath, result.startTimeIso, slideDataManager.getBeijingTimeISO(), result.userName, result.experimentName);
        } catch (e) { console.error('❌ 复制通用数据到实验目录失败:', e.message); }
      }
      if (result.success) return res.json({ success: true });
      return res.status(500).json({ error: result.error || '实验结束失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  app.post('/api/slide-data/experiment/force-end', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { source } = req.body;
      if (!source) return res.status(400).json({ error: '缺少必要参数: source' });
      const result = slideDataManager.forceEndExperiment(ip, source);
      if (result.success) return res.json({ success: true });
      return res.status(500).json({ error: result.error || '实验强制结束失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  app.get('/api/slide-data/sessions/active', (req, res) => {
    try { 
      console.log('📋 API收到获取活跃会话请求');
      const activeSessions = slideDataManager.getAllActiveSessions(); 
      console.log('📋 返回活跃会话数据:', activeSessions);
      console.log('📋 活跃会话数量:', activeSessions.length);
      return res.json({ success: true, activeSessions, count: activeSessions.length }); 
    }
    catch (e) { 
      console.error('❌ 获取活跃会话失败:', e);
      return res.status(500).json({ error: '获取活跃会话失败' }); 
    }
  });

  // 获取会话历史记录
  app.get('/api/slide-data/sessions/history', (req, res) => {
    try { 
      const sessionHistory = slideDataManager.loadSessionHistory(); 
      console.log('📋 返回会话历史数据:', Object.keys(sessionHistory).length, '个用户');
      return res.json({ success: true, sessionHistory }); 
    }
    catch (e) { 
      console.error('❌ 获取会话历史失败:', e);
      return res.status(500).json({ error: '获取会话历史失败' }); 
    }
  });

  // 获取客户端IP地址
  app.get('/api/client-ip', (req, res) => {
    try {
      const clientIP = getClientIPFromReq(req);
      console.log('🔍 获取客户端IP:', clientIP);
      res.json({ success: true, ip: clientIP });
    } catch (error) {
      console.error('❌ 获取IP失败:', error);
      res.status(500).json({ error: '获取IP失败' });
    }
  });

  // 获取指定IP的会话信息
  app.get('/api/slide-data/sessions/:ip', (req, res) => {
    try {
      const { ip } = req.params;
      const session = slideDataManager.getActiveSession(ip);
      if (session) return res.json({ success: true, session });
      return res.json({ success: true, session: null, message: '没有找到活跃会话' });
    } catch (e) { return res.status(500).json({ error: '获取会话信息失败' }); }
  });

  // 硬件时间戳记录
  app.post('/api/slide-data/hardware/timestamp', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { timestampType, timestamp, userName, experimentName } = req.body;
      if (!timestampType || !timestamp) return res.status(400).json({ error: '缺少必要参数: timestampType, timestamp' });
      const normalizedIP = ip;
      console.log('🔥 硬件时间戳API请求:', { ip: normalizedIP, timestampType, timestamp, userName, experimentName });
      const result = slideDataManager.recordHardwareTimestamp(normalizedIP, timestampType, timestamp, userName, experimentName);
      if (result.success) return res.json({ success: true, timestamp: result.timestamp });
      return res.status(500).json({ error: result.error || '时间戳记录失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  // 手机时间戳记录
  app.post('/api/slide-data/mobile/timestamp', (req, res) => {
    try {
      const ip = getClientIPFromReq(req);
      const { timestampType, timestamp, userName, experimentName } = req.body;
      if (!timestampType || !timestamp) return res.status(400).json({ error: '缺少必要参数: timestampType, timestamp' });
      const normalizedIP = ip;
      console.log('📱 手机时间戳API请求:', { ip: normalizedIP, timestampType, timestamp, userName, experimentName });
      const result = slideDataManager.recordMobileTimestamp(normalizedIP, timestampType, timestamp, userName, experimentName);
      if (result.success) return res.json({ success: true, timestamp: result.timestamp });
      return res.status(500).json({ error: result.error || '时间戳记录失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  // 硬件数据自动处理
  app.post('/api/slide-data/hardware/process', (req, res) => {
    try {
      const normalizedIP = getClientIPFromReq(req);
      const result = slideDataManager.processHardwareData(normalizedIP);
      if (result.success) return res.json({ success: true, processedData: result.processedData });
      return res.status(500).json({ error: result.error || '硬件数据自动处理失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  // 手机数据自动处理
  app.post('/api/slide-data/mobile/process', (req, res) => {
    try {
      const normalizedIP = getClientIPFromReq(req);
      const result = slideDataManager.processMobileData(normalizedIP);
      if (result.success) return res.json({ success: true, processedData: result.processedData });
      return res.status(500).json({ error: result.error || '手机数据自动处理失败' });
    } catch (e) { return res.status(500).json({ error: '服务器内部错误' }); }
  });

  // 调试端点 - 测试连接
  app.get('/api/debug/connection-test', (req, res) => {
    const clientIP = getClientIPFromReq(req);
    res.json({
      success: true,
      message: '连接测试成功',
      clientIP: clientIP,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    });
  });

  // 处理自动播放进度记录
  socket.on('auto_progress_record', (data) => {
    console.log('记录自动播放进度:', data.position + '%', '消息:', data.messageId);
    console.log('自动播放数据详情:', {
      sender: data.sender,
      messageId: data.messageId,
      position: data.position
    });
    
    // 记录自动播放数据 - 使用全局状态或传入数据
    if (data.position !== undefined && data.position !== null) {
      const playbackInfo = getCurrentPlaybackInfo(clientIP);
      slideDataManager.recordAutoProgress(
        clientIP, 
        data.position, 
        data.sender || playbackInfo.sender, 
        data.messageId || playbackInfo.messageId
      );
    } else {
      console.warn('⚠️ 自动播放数据无效:', data);
    }
  });

  // 处理播放状态更新
  socket.on('playback_state_update', (data) => {
    console.log('收到播放状态更新:', data);
    updatePlaybackState(clientIP, data.messageId, data.sender, data.isPlaying);
    
    // 集成用户行为记录
    if (data.isPlaying && socket.userId) {
      const user = db.getUser(socket.userId);
      if (user) {
        console.log(`🔍 开始记录用户行为: IP=${clientIP}, userId=${socket.userId}, username=${user.username}`);
        // 开始记录用户行为
        userBehaviorLogger.startSession(
          clientIP, 
          user.username, 
          data.sender, 
          data.messageId
        );
      } else {
        console.log(`⚠️ 无法开始记录: 用户不存在 (userId=${socket.userId})`);
      }
    } else if (!data.isPlaying && socket.userId) {
      console.log(`🔍 结束记录用户行为: IP=${clientIP}, userId=${socket.userId}`);
      // 停止播放时结束会话
      userBehaviorLogger.endSession(clientIP);
    } else {
      console.log(`⚠️ 无法记录用户行为: 用户未登录或数据不完整 (IP=${clientIP}, userId=${socket.userId}, isPlaying=${data.isPlaying})`);
    }
  });

  // 处理停止其他音频的信号
  socket.on('stop_other_audio', (data) => {
    console.log('收到停止其他音频信号:', data.messageId);
    
    // 广播给所有连接的客户端
    io.emit('stop_other_audio', {
      messageId: data.messageId,
      timestamp: data.timestamp
    });
  });

  // 处理停止其他长音频的信号
  socket.on('stop_other_long_audio', (data) => {
    console.log('收到停止其他长音频信号:', data.messageId);
    
    // 广播给所有连接的客户端
    io.emit('stop_other_long_audio', {
      messageId: data.messageId,
      timestamp: data.timestamp
    });
  });

  // 处理暂停长音频的信号
  socket.on('pause_long_audio', (data) => {
    console.log('收到暂停长音频信号:', data.messageId);
    
    // 广播给所有连接的客户端
    io.emit('pause_long_audio', {
      messageId: data.messageId,
      timestamp: data.timestamp
    });
  });

  // 处理恢复长音频的信号
  socket.on('resume_long_audio', (data) => {
    console.log('收到恢复长音频信号:', data.messageId);
    
    // 广播给所有连接的客户端
    io.emit('resume_long_audio', {
      messageId: data.messageId,
      timestamp: data.timestamp
    });
  });

  // 处理停止其他段音频的信号
  socket.on('stop_other_segment_audio', (data) => {
    console.log('收到停止其他段音频信号:', data.messageId);
    
    // 广播给所有连接的客户端
    io.emit('stop_other_segment_audio', {
      messageId: data.messageId,
      timestamp: data.timestamp
    });
  });

  // 用户身份识别
  socket.on('identify', (data) => {
    const { userId } = data;
    if (userId) {
      const user = db.getUser(userId);
      if (user) {
        db.userOnline(userId, socket, user);
        socket.userId = userId;
        socket.emit('identify_ack', { userId });
        
        // 记录连接数据
        slideDataManager.recordConnection(clientIP, userId, {
          username: user.username,
          name: user.name,
          avatar: user.avatar
        });
        
        // 广播用户上线状态
        io.emit('user_status_change', {
          userId,
          online: true
        });
        
        console.log(`✅ 用户登录成功: ${user.username} (${userId}) - IP: ${clientIP}`);
      }
    }
  });

  // 测试用户登录（用于开发测试）
  socket.on('test_login', (data) => {
    const { username } = data;
    if (username) {
      // 创建或获取测试用户
      let user = db.getUserByUsername(username);
      if (!user) {
        user = db.createUser(username);
        console.log(`🆕 创建测试用户: ${username}`);
      }
      
      // 设置用户在线
      db.userOnline(user.id, socket, user);
      socket.userId = user.id;
      socket.emit('identify_ack', { userId: user.id, username: user.username });
      
      console.log(`✅ 测试用户登录成功: ${username} (${user.id}) - IP: ${clientIP}`);
      
      // 广播用户上线状态
      io.emit('user_status_change', {
        userId: user.id,
        online: true
      });
    }
  });

  // 处理聊天消息
  socket.on('chat_message', async (data) => {
    const { targetUserId, senderId, senderName, senderImg, content, messageType } = data;
    
    console.log('处理聊天消息:', data);
    
    // 如果是文本消息，生成摘要
    let summaryData = null;
    if (messageType === 'text' && content) {
      try {
        summaryData = await summarizationService.processTextMessage(content);
        console.log('文本摘要生成:', summaryData);
      } catch (error) {
        console.error('生成文本摘要失败:', error);
      }
    }
    
    // 消息存储到发送者的聊天记录中
    const senderMessage = db.addMessage(senderId, {
      senderId,
      senderName,
      senderImg,
      content,
      type: messageType || 'text',
      me: true,
      summary: summaryData
    });
    
    // 消息存储到接收者的聊天记录中
    const receiverMessage = db.addMessage(targetUserId, {
      senderId,
      senderName,
      senderImg,
      content,
      type: messageType || 'text',
      me: false,
      summary: summaryData
    });
    
    // 发送消息给目标用户
    db.sendToUser(targetUserId, {
      type: 'new_message',
      message: receiverMessage
    });
    
    // 发送确认消息给发送者
    socket.emit('message_sent', {
      type: 'message_ack',
      message: senderMessage
    });
  });

  // 处理语音消息
  socket.on('voice_message', async (data) => {
    const { targetUserId, senderId, senderName, senderImg, audioData, duration, serverFileInfo } = data;
    
    console.log('处理语音消息:', { senderId, targetUserId, duration, serverFileInfo });
    
    // 处理语音摘要
    let summaryData = null;
    try {
      if (serverFileInfo && serverFileInfo.source === 'server_file') {
        // 服务器文件：直接使用已处理的结果
        const { root, relativePath } = serverFileInfo;
        const abs = safeJoin(root, relativePath);
        if (abs && fs.existsSync(abs)) {
          summaryData = await summarizationService.processVoiceFile(abs);
          console.log('服务器文件摘要生成:', summaryData);
        } else {
          throw new Error('服务器文件路径无效');
        }
      } else {
        // 本地上传：将base64音频数据转换为Buffer
        const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');
        summaryData = await summarizationService.processVoiceMessage(audioBuffer);
        console.log('本地音频摘要生成:', summaryData);
      }
    } catch (error) {
      console.error('生成语音摘要失败:', error);
    }
    
    // 生成消息ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 构建audioMetadata，确保与现有语音消息结构一致
    const audioMetadata = summaryData ? {
      sender: senderName,
      role: 'user',
      filename: serverFileInfo ? serverFileInfo.filename : 'audio.mp3',
      audio_duration_sec: summaryData.audio_duration_sec || duration,
      msg_type: summaryData.msg_type || 'task',
      emotion: summaryData.emotion || '中性',
      segments: convertSegmentsToFrontendFormat(summaryData.segments || [], summaryData.audio_duration_sec || duration),
      overall_summary: summaryData.summary || summaryData.overall_summary || '',
      transcript: summaryData.transcript || '',
      transcript_clean: summaryData.transcript_clean || ''
    } : null;

    const voiceMessage = {
      id: messageId,
      senderId,
      senderName,
      senderImg,
      content: JSON.stringify({ 
        audioData: serverFileInfo ? `server_file:${serverFileInfo.root}/${serverFileInfo.relativePath}` : audioData, 
        duration,
        serverFileInfo: serverFileInfo || null
      }),
      type: 'voice',
      me: true,
      summary: summaryData,
      audioMetadata: audioMetadata,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleString('zh-CN', {
        year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).replace(/\//g, '/')
    };
    
    const senderMessage = db.addMessage(senderId, voiceMessage);
    const receiverMessage = db.addMessage(targetUserId, {
      ...voiceMessage,
      me: false,
      audioMetadata: audioMetadata ? {
        ...audioMetadata,
        role: 'other'
      } : null
    });
    
    // 发送语音消息给目标用户
    db.sendToUser(targetUserId, {
      type: 'new_voice_message',
      message: receiverMessage
    });
    
    socket.emit('message_sent', {
      type: 'voice_message_ack',
      message: senderMessage
    });
  });

  // 处理文件上传
  socket.on('file_message', (data) => {
    const { targetUserId, senderId, senderName, senderImg, fileName, fileData, fileType } = data;
    
    const fileMessage = {
      senderId,
      senderName,
      senderImg,
      content: JSON.stringify({ fileName, fileData, fileType }),
      type: 'file',
      me: true
    };
    
    const senderMessage = db.addMessage(senderId, fileMessage);
    const receiverMessage = db.addMessage(targetUserId, {
      ...fileMessage,
      me: false
    });
    
    db.sendToUser(targetUserId, {
      type: 'new_file_message',
      message: receiverMessage
    });
    
    socket.emit('message_sent', {
      type: 'file_message_ack',
      message: senderMessage
    });
  });

  // 用户正在输入
  socket.on('typing', (data) => {
    const { targetUserId, isTyping } = data;
    db.sendToUser(targetUserId, {
      type: 'user_typing',
      userId: socket.userId,
      isTyping
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    if (socket.userId) {
      db.userOffline(socket.userId);
      io.emit('user_status_change', {
        userId: socket.userId,
        online: false
      });
    }
    console.log('用户断开连接:', socket.id);
  });
});

// API路由

// 用户登录/注册
app.post('/api/login', (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    
    if (username.trim().length < 2) {
      return res.status(400).json({ error: '用户名至少需要2个字符' });
    }
    
    // 创建或获取用户
    const user = db.createUser(username.trim());
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取用户列表
app.get('/api/users', (req, res) => {
  try {
    const { excludeUserId } = req.query;
    const users = db.getUsers(excludeUserId);
    res.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 获取用户消息
app.get('/api/messages/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const messages = db.getMessages(userId);
    db.resetMessageCount(userId);
    res.json(messages);
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 发送消息
app.post('/api/messages', (req, res) => {
  try {
    const { targetUserId, senderId, senderName, senderImg, content, messageType } = req.body;
    
    const newMessage = db.addMessage(targetUserId, {
      senderId,
      senderName,
      senderImg,
      content,
      type: messageType || 'text',
      me: false
    });
    
    // 实时发送给在线用户
    db.sendToUser(targetUserId, {
      type: 'new_message',
      message: newMessage
    });
    
    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// 获取好友列表
app.get('/api/friends/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const friends = db.getFriends(userId);
    res.json(friends);
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

// 添加好友
app.post('/api/friends', (req, res) => {
  try {
    const { userId, friendId } = req.body;
    db.addFriend(userId, friendId);
    res.json({ success: true });
  } catch (error) {
    console.error('添加好友失败:', error);
    res.status(500).json({ error: '添加好友失败' });
  }
});

// 删除用户数据
app.delete('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    db.deleteUserData(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 处理语音摘要
app.post('/api/summarize/voice', async (req, res) => {
  try {
    const { audioData } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: '音频数据不能为空' });
    }
    
    // 将base64音频数据转换为Buffer
    const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');
    const result = await summarizationService.processVoiceMessage(audioBuffer);
    
    res.json(result);
  } catch (error) {
    console.error('语音摘要失败:', error);
    res.status(500).json({ error: '语音摘要失败' });
  }
});

// 处理文本摘要
app.post('/api/summarize/text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '文本不能为空' });
    }
    
    const result = await summarizationService.processTextMessage(text);
    res.json(result);
  } catch (error) {
    console.error('文本摘要失败:', error);
    res.status(500).json({ error: '文本摘要失败' });
  }
});

// 获取音频消息统计
app.get('/api/audio/stats', (req, res) => {
  try {
    const stats = db.getAudioMessageStats();
    res.json(stats);
  } catch (error) {
    console.error('获取音频统计失败:', error);
    res.status(500).json({ error: '获取音频统计失败' });
  }
});

// 获取音频消息列表
app.get('/api/audio/messages', (req, res) => {
  try {
    const { userId } = req.query;
    const audioMessages = db.getAudioMessages(userId);
    res.json(audioMessages);
  } catch (error) {
    console.error('获取音频消息失败:', error);
    res.status(500).json({ error: '获取音频消息失败' });
  }
});

// 发送音频消息
app.post('/api/send-audio-message', (req, res) => {
  try {
    const { targetUserId, audioMessageId, senderId } = req.body;
    
    // 查找原始音频消息
    let originalMessage = null;
    Object.values(db.messages).forEach(userMessages => {
      const found = userMessages.find(msg => msg.id === audioMessageId);
      if (found) {
        originalMessage = found;
      }
    });
    
    if (!originalMessage) {
      return res.status(404).json({ error: '音频消息不存在' });
    }
    
    // 创建新的消息发送给目标用户
    const newMessage = {
      ...originalMessage,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: senderId,
      me: false,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleString('zh-CN', {
        year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).replace(/\//g, '/')
    };
    
    // 添加到目标用户的消息列表
    db.addMessage(targetUserId, newMessage);
    
    // 通过WebSocket发送给在线用户
    const targetUserData = db.onlineUsers.get(targetUserId);
    if (targetUserData && targetUserData.socket.connected) {
      targetUserData.socket.emit('new_message', newMessage);
    }
    
    // 同时添加到发送者的消息列表（作为自己发送的消息）
    const senderMessage = {
      ...newMessage,
      me: true,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_sender`
    };
    db.addMessage(senderId, senderMessage);
    
    res.json({ success: true, message: senderMessage });
  } catch (error) {
    console.error('发送音频消息失败:', error);
    res.status(500).json({ error: '发送音频消息失败' });
  }
});

// 滑动数据查询API端点

// 获取指定日期的连接数据
app.get('/api/slide-data/connections/:date', (req, res) => {
  try {
    const { date } = req.params; // 格式: MMDD (如: 0823)
    const connections = slideDataManager.getConnectionsByDate(date);
    res.json({
      success: true,
      date: date,
      connections: connections,
      count: connections.length
    });
  } catch (error) {
    console.error('获取连接数据失败:', error);
    res.status(500).json({ error: '获取连接数据失败' });
  }
});

// 获取指定IP和日期的进度数据
app.get('/api/slide-data/progress/:date/:ip', (req, res) => {
  try {
    const { date, ip } = req.params; // 格式: MMDD (如: 0823), IP地址
    const progress = slideDataManager.getProgressByIPAndDate(ip, date);
    res.json({
      success: true,
      date: date,
      ip: ip,
      progress: progress,
      count: progress.length
    });
  } catch (error) {
    console.error('获取进度数据失败:', error);
    res.status(500).json({ error: '获取进度数据失败' });
  }
});

// 获取指定日期的所有IP进度数据
app.get('/api/slide-data/progress/:date', (req, res) => {
  try {
    const { date } = req.params; // 格式: MMDD (如: 0823)
    const allProgress = slideDataManager.getAllProgressByDate(date);
    res.json({
      success: true,
      date: date,
      progress: allProgress,
      ipCount: Object.keys(allProgress).length,
      totalRecords: Object.values(allProgress).reduce((sum, records) => sum + records.length, 0)
    });
  } catch (error) {
    console.error('获取所有进度数据失败:', error);
    res.status(500).json({ error: '获取所有进度数据失败' });
  }
});

// 获取今日的滑动数据概览
app.get('/api/slide-data/today', (req, res) => {
  try {
    const today = slideDataManager.formatDateMMDD(slideDataManager.getBeijingTime());
    const connections = slideDataManager.getConnectionsByDate(today);
    const allProgress = slideDataManager.getAllProgressByDate(today);
    
    res.json({
      success: true,
      date: today,
      summary: {
        connections: connections.length,
        uniqueIPs: Object.keys(allProgress).length,
        totalProgressRecords: Object.values(allProgress).reduce((sum, records) => sum + records.length, 0),
        progressBySource: Object.values(allProgress).flat().reduce((acc, record) => {
          acc[record.source] = (acc[record.source] || 0) + 1;
          return acc;
        }, {})
      },
      connections: connections,
      progress: allProgress
    });
  } catch (error) {
    console.error('获取今日数据失败:', error);
    res.status(500).json({ error: '获取今日数据失败' });
  }
});

// 处理React路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`🌐 绑定到所有网络接口 (0.0.0.0:${PORT})`);
  console.log(`📱 手机访问地址: http://[你的电脑IP]:${PORT}`);
  console.log(`💻 本地访问地址: http://localhost:${PORT}`);
  console.log(`📝 用户行为记录器已初始化`);
  console.log(`📁 输出目录: ${userBehaviorLogger.outputPath}`);
  console.log(`🔧 硬件支持: ${process.env.ENABLE_SERIAL !== 'false' ? '启用' : '禁用'}`);
  console.log(`⚙️ 串口配置: ${process.env.SERIAL_PORT || 'COM3'}:${process.env.BAUD_RATE || '115200'}`);
  console.log(`💾 活跃会话持久化已启用`);
});

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到 SIGINT 信号，正在优雅关闭服务器...');
  slideDataManager.cleanup();
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在优雅关闭服务器...');
  slideDataManager.cleanup();
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
}); 