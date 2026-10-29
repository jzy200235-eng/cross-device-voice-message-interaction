const fs = require('fs');
const path = require('path');
const Database = require('./database');

class AudioDataImporter {
  constructor() {
    this.database = new Database();
    this.audioDataPath = path.join(__dirname, '../combined_audio/combined_audio_results.json');
    this.segmentsPath = path.join(__dirname, '../combined_audio');
  }

  loadAudioData() {
    try {
      const audioData = JSON.parse(fs.readFileSync(this.audioDataPath, 'utf8'));
      console.log(`加载了 ${audioData.length} 个音频文件的数据`);
      return audioData;
    } catch (error) {
      console.error('加载音频数据失败:', error);
      return [];
    }
  }

  loadSegmentsData(fileId) {
    try {
      const segmentsPath = path.join(this.segmentsPath, fileId, `${fileId}_segments.json`);
      if (fs.existsSync(segmentsPath)) {
        return JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
      }
    } catch (error) {
      console.error(`加载分割数据失败 ${fileId}:`, error);
    }
    return null;
  }

  createUsersFromAudioData(audioData) {
    const users = new Set();
    audioData.forEach(item => {
      // 从description中提取发送人信息
      const sender = this.extractSenderFromDescription(item);
      if (sender) {
        users.add(sender);
      }
    });

    const userMap = new Map();

    users.forEach(sender => {
      const user = this.database.createUser(sender);
      userMap.set(sender, user);
      console.log(`创建用户: ${sender} (ID: ${user.id})`);
    });

    return userMap;
  }

  extractSenderFromDescription(item, segmentsData = null) {
    // 在 item.segments 或回退到 segmentsData.segments 中查找
    const segments = (item && item.segments) || (segmentsData && segmentsData.segments) || [];
    const summarySegment = segments.find(s => s.type === 'summary' && s.description);
    if (!summarySegment || !summarySegment.description) return null;

    const desc = String(summarySegment.description);
    // 兼容中英文冒号、不同终止符，尽量宽松匹配
    const patterns = [
      /发送人\s*[:：]\s*([^。.;\n\r]+)/,               // 发送人：XXX。
      /发\s*送\s*人\s*[:：]\s*([^。.;\n\r]+)/         // 宽松匹配可能的空格
    ];
    for (const re of patterns) {
      const m = desc.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  convertAudioToMessages(audioData, userMap) {
    const messages = [];

    audioData.forEach((item, index) => {
      // 先加载分割信息，供后续解析发送人与摘要使用
      const segmentsData = this.loadSegmentsData(item.file_id);

      // 从description中提取发送人信息（若item中无匹配，回退到segmentsData）
      const senderName = this.extractSenderFromDescription(item, segmentsData);
      if (!senderName) {
        console.warn(`无法提取发送人信息: ${item.file_id}`);
        return;
      }

      const sender = userMap.get(senderName);
      if (!sender) {
        console.warn(`未找到用户: ${senderName}`);
        return;
      }

      // segmentsData 已在上面加载
      
      // 检查组合音频文件是否存在
      const combinedAudioPath = path.join(__dirname, '../combined_audio', item.file_id, `${item.file_id}_combined.mp3`);
      if (!fs.existsSync(combinedAudioPath)) {
        console.warn(`组合音频文件不存在: ${combinedAudioPath}`);
        return;
      }

      console.log(`处理音频文件: ${item.file_id} (${senderName})`);

      const voiceMessage = {
        id: `msg_voice_${item.file_id}`,
        senderId: sender.id,
        senderName: sender.name,
        senderImg: sender.avatar,
        content: JSON.stringify({
          audioData: `/audio/${item.file_id}/${item.file_id}_combined.mp3`, // 使用HTTP路径
          duration: item.total_duration,
          filename: `${item.file_id}_combined.mp3`,
          fileId: item.file_id
        }),
        type: 'voice',
        me: false,
        timestamp: new Date(Date.now() - (audioData.length - index) * 60000).toISOString(),
        time: new Date(Date.now() - (audioData.length - index) * 60000).toLocaleString('zh-CN', {
          year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(/\//g, '/'),
        summary: {
          success: true,
          transcript: this.extractSummaryFromDescription(item, segmentsData),
          summary: this.extractSummaryFromDescription(item, segmentsData),
          highlights: segmentsData ? this.convertSegmentsToHighlights(segmentsData.segments) : [],
          warnings: [],
          audio_duration_sec: item.total_duration,
          timestamp: new Date().toISOString()
        },
        audioMetadata: {
          file_id: item.file_id,
          filename: `${item.file_id}_combined.mp3`,
          sender: senderName,
          audio_duration_sec: item.total_duration,
          role: senderName.split(' ')[0] || '员工',
          segments: segmentsData ? segmentsData.segments : []
        }
      };

      messages.push(voiceMessage);
    });

    return messages;
  }

  extractSummaryFromDescription(item, segmentsData = null) {
    // 优先使用 overall_summary 字段
    if (item && item.overall_summary && String(item.overall_summary).trim()) {
      return String(item.overall_summary).trim();
    }
    if (segmentsData && segmentsData.overall_summary && String(segmentsData.overall_summary).trim()) {
      return String(segmentsData.overall_summary).trim();
    }

    // 在 item.segments 或回退到 segmentsData.segments 中查找 summary 段
    const segments = (item && item.segments) || (segmentsData && segmentsData.segments) || [];
    const summarySegment = segments.find(s => s.type === 'summary' && s.description);
    if (!summarySegment || !summarySegment.description) return '暂无摘要';

    const desc = String(summarySegment.description);
    // 先尝试提取“发送人：XXX。后面的整句作为摘要”
    const afterSender = desc.replace(/^\s*发\s*送\s*人\s*[:：][^。.;\n\r]+[。.;]\s*/,'').trim();
    if (afterSender && afterSender.length > 0) {
      return afterSender;
    }
    // 兼容“总摘要/摘要：...”
    const patterns = [
      /总?\s*摘\s*要\s*[:：]\s*([\s\S]+)/,
    ];
    for (const re of patterns) {
      const m = desc.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return '暂无摘要';
  }

  convertSegmentsToHighlights(segments) {
    const highlights = [];
    const partGroups = new Map();

    // 按part分组
    segments.forEach(segment => {
      if (!partGroups.has(segment.part)) {
        partGroups.set(segment.part, []);
      }
      partGroups.get(segment.part).push(segment);
    });

    // 为每个part创建一个highlight
    partGroups.forEach((partSegments, partNum) => {
      const summarySegment = partSegments.find(s => s.type === 'summary_tts');
      const originalSegment = partSegments.find(s => s.type === 'original_audio');

      if (summarySegment && originalSegment) {
        highlights.push({
          summary_text: summarySegment.description.replace(`分摘要${partNum}：`, ''),
          original_text: originalSegment.description.replace(`原语音片段${partNum}：`, ''),
          start_time_sec: originalSegment.start_time,
          end_time_sec: originalSegment.end_time,
          duration_sec: originalSegment.duration
        });
      }
    });

    return highlights;
  }

  distributeMessagesToUsers(messages, userMap) {
    const userList = Array.from(userMap.values());
    
    // 为每个用户分配所有音频消息
    userList.forEach(user => {
      messages.forEach(message => {
        // 将消息分配给当前用户，但标记为不是自己发送的
        const userMessage = {
          ...message,
          me: message.senderId === user.id
        };
        this.database.addPreprocessedMessage(user.id, userMessage);
      });
    });

    console.log(`为 ${userList.length} 个用户分配了 ${messages.length} 条音频消息`);
  }

  createFriendships(userMap) {
    const userList = Array.from(userMap.values());
    
    userList.forEach(user => {
      userList.forEach(otherUser => {
        if (user.id !== otherUser.id) {
          this.database.addFriend(user.id, otherUser.id);
        }
      });
    });

    console.log(`为用户创建了友谊关系`);
  }

  async import() {
    console.log('开始导入组合音频数据...');

    // 清空现有数据
    this.database.clearAllData();

    // 加载音频数据
    const audioData = this.loadAudioData();
    if (audioData.length === 0) {
      console.error('没有找到音频数据');
      return;
    }

    // 创建用户
    const userMap = this.createUsersFromAudioData(audioData);

    // 转换音频数据为消息
    const messages = this.convertAudioToMessages(audioData, userMap);
    console.log(`转换了 ${messages.length} 条音频消息`);

    // 分配消息给用户
    this.distributeMessagesToUsers(messages, userMap);

    // 创建友谊关系
    this.createFriendships(userMap);

    console.log('音频数据导入完成！');
  }

  clearData() {
    console.log('清空所有数据...');
    this.database.clearAllData();
    console.log('数据清空完成！');
  }
}

// 命令行接口
if (require.main === module) {
  const importer = new AudioDataImporter();
  const command = process.argv[2];

  switch (command) {
    case 'import':
      importer.import();
      break;
    case 'clear':
      importer.clearData();
      break;
    case 'help':
    default:
      console.log('使用方法:');
      console.log('  node import-audio-data.js import  - 导入组合音频数据');
      console.log('  node import-audio-data.js clear   - 清空所有数据');
      console.log('  node import-audio-data.js help    - 显示帮助信息');
      break;
  }
}

module.exports = AudioDataImporter; 