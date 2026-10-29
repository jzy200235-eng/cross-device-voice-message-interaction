const fs = require('fs');
const path = require('path');

class SlideDataManager {
    constructor() {
        this.slideDataPath = path.join(__dirname, 'slidedata');
        this.connectionsPath = path.join(this.slideDataPath, 'connections');
        this.progressPath = path.join(this.slideDataPath, 'progress');
        
        // 确保目录存在
        this.ensureDirectories();
    }

    // 确保目录存在
    ensureDirectories() {
        if (!fs.existsSync(this.slideDataPath)) {
            fs.mkdirSync(this.slideDataPath, { recursive: true });
        }
        if (!fs.existsSync(this.connectionsPath)) {
            fs.mkdirSync(this.connectionsPath, { recursive: true });
        }
        if (!fs.existsSync(this.progressPath)) {
            fs.mkdirSync(this.progressPath, { recursive: true });
        }
    }

    // 获取北京时间
    getBeijingTime() {
        const now = new Date();
        // 北京时间是UTC+8
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        return beijingTime;
    }

    // 格式化日期为MMDD格式
    formatDateMMDD(date) {
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${month}${day}`;
    }

    // 格式化完整时间戳
    formatTimestamp(date) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    // 记录连接数据
    recordConnection(ip, userId, userInfo) {
        try {
            const beijingTime = this.getBeijingTime();
            const dateStr = this.formatDateMMDD(beijingTime);
            const timestamp = this.formatTimestamp(beijingTime);
            
            const connectionData = {
                ip: ip,
                userId: userId,
                userInfo: userInfo,
                connectTime: timestamp,
                timestamp: beijingTime.getTime()
            };

            const connectionsFile = path.join(this.connectionsPath, `${dateStr}-connections.json`);
            
            let connections = [];
            if (fs.existsSync(connectionsFile)) {
                connections = JSON.parse(fs.readFileSync(connectionsFile, 'utf8'));
            }
            
            connections.push(connectionData);
            
            fs.writeFileSync(connectionsFile, JSON.stringify(connections, null, 2), 'utf8');
            console.log(`📝 记录连接数据: ${ip} - ${userId} at ${timestamp}`);
            
        } catch (error) {
            console.error('❌ 记录连接数据失败:', error);
        }
    }

    // 记录滑动进度条数据
    recordProgress(ip, position, sender, messageId, source = 'unknown') {
        try {
            const beijingTime = this.getBeijingTime();
            const dateStr = this.formatDateMMDD(beijingTime);
            const timestamp = this.formatTimestamp(beijingTime);
            
            // 处理IP地址，转换为安全的文件名
            const safeIP = this.sanitizeIPForFilename(ip);
            
            // 添加调试信息
            console.log('📊 记录滑动数据详情:');
            console.log('  原始IP:', ip);
            console.log('  安全IP:', safeIP);
            console.log('  位置:', position);
            console.log('  发送者:', sender);
            console.log('  消息ID:', messageId);
            console.log('  来源:', source);
            
            const progressData = {
                position: position,
                sender: sender,
                messageId: messageId,
                source: source, // 'hardware', 'web', 'auto'
                timestamp: timestamp,
                unixTimestamp: beijingTime.getTime(),
                originalIP: ip // 保存原始IP地址
            };

            const progressFile = path.join(this.progressPath, `${dateStr}-${safeIP}.json`);
            
            // 确保目录存在
            const dir = path.dirname(progressFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            let progressRecords = [];
            if (fs.existsSync(progressFile)) {
                progressRecords = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
            }
            
            progressRecords.push(progressData);
            
            fs.writeFileSync(progressFile, JSON.stringify(progressRecords, null, 2), 'utf8');
            console.log(`📊 记录滑动数据: ${ip} (${safeIP}) - 位置${position}% - ${sender} at ${timestamp}`);
            console.log(`📁 保存到文件: ${progressFile}`);
            
        } catch (error) {
            console.error('❌ 记录滑动数据失败:', error);
            console.error('IP地址:', ip);
            console.error('目标文件:', path.join(this.progressPath, `${this.formatDateMMDD(this.getBeijingTime())}-${this.sanitizeIPForFilename(ip)}.json`));
            console.error('错误详情:', error.message);
        }
    }

    // 记录自动播放进度（没有滑动时的正常播放）
    recordAutoProgress(ip, position, sender, messageId) {
        this.recordProgress(ip, position, sender, messageId, 'auto');
    }

    // 获取指定日期的连接数据
    getConnectionsByDate(dateStr) {
        try {
            const connectionsFile = path.join(this.connectionsPath, `${dateStr}-connections.json`);
            if (fs.existsSync(connectionsFile)) {
                return JSON.parse(fs.readFileSync(connectionsFile, 'utf8'));
            }
            return [];
        } catch (error) {
            console.error('❌ 读取连接数据失败:', error);
            return [];
        }
    }

    // 获取指定IP和日期的进度数据
    getProgressByIPAndDate(ip, dateStr) {
        try {
            const safeIP = this.sanitizeIPForFilename(ip);
            const progressFile = path.join(this.progressPath, `${dateStr}-${safeIP}.json`);
            if (fs.existsSync(progressFile)) {
                return JSON.parse(fs.readFileSync(progressFile, 'utf8'));
            }
            return [];
        } catch (error) {
            console.error('❌ 读取进度数据失败:', error);
            return [];
        }
    }

    // 获取所有IP的进度数据
    getAllProgressByDate(dateStr) {
        try {
            const files = fs.readdirSync(this.progressPath);
            const progressData = {};
            
            files.forEach(file => {
                if (file.startsWith(dateStr) && file.endsWith('.json')) {
                    const safeIP = file.replace(`${dateStr}-`, '').replace('.json', '');
                    const filePath = path.join(this.progressPath, file);
                    progressData[safeIP] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            });
            
            return progressData;
        } catch (error) {
            console.error('❌ 读取所有进度数据失败:', error);
            return {};
        }
    }

    // 将IP地址转换为安全的文件名
    sanitizeIPForFilename(ip) {
        if (!ip) return 'unknown';
        
        // 处理IPv6地址
        if (ip.includes(':')) {
            // 将IPv6地址转换为安全的字符串
            return ip.replace(/:/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        
        // 处理IPv4地址
        return ip.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
    }
}

module.exports = SlideDataManager; 