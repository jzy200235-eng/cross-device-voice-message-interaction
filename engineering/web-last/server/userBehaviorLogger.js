const fs = require('fs');
const path = require('path');

class UserBehaviorLogger {
    constructor() {
        this.outputPath = path.join(__dirname, '../output');
        this.activeSessions = new Map(); // IP -> { username, sender, fileId, startTime, sessionId }
        
        // 确保输出目录存在
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath, { recursive: true });
        }
    }

    // 生成会话ID（用于文件名）
    generateSessionId(sender, startTime) {
        const date = new Date(startTime);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        const second = date.getSeconds().toString().padStart(2, '0');
        
        return `${sender}${month}${day}${hour}${minute}${second}`;
    }

    // 开始记录用户行为
    startSession(ip, username, sender, fileId) {
        const startTime = new Date();
        const sessionId = this.generateSessionId(sender, startTime);
        
        // 如果之前有活跃会话，先结束它
        if (this.activeSessions.has(ip)) {
            this.endSession(ip);
        }
        
        // 创建新的活跃会话
        this.activeSessions.set(ip, {
            username,
            sender,
            fileId,
            startTime,
            sessionId
        });
        
        // 创建用户目录和文件
        this.createUserFiles(username, sessionId, sender, fileId, startTime);
        
        console.log(`📝 开始记录用户行为: ${username} -> ${sender} (${fileId}) [${sessionId}]`);
        
        return sessionId;
    }

    // 结束会话
    endSession(ip) {
        const session = this.activeSessions.get(ip);
        if (session) {
            console.log(`📝 结束记录用户行为: ${session.username} -> ${session.sender} [${session.sessionId}]`);
            this.activeSessions.delete(ip);
        }
    }

    // 创建用户文件和目录
    createUserFiles(username, sessionId, sender, fileId, startTime) {
        const userDir = path.join(this.outputPath, username);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const baseFileName = sessionId;
        const jsonPath = path.join(userDir, `${baseFileName}.json`);
        const csvPath = path.join(userDir, `${baseFileName}.csv`);
        
        // 创建JSON文件头
        const jsonHeader = {
            sessionInfo: {
                username,
                sender,
                fileId,
                startTime: startTime.toISOString(),
                sessionId
            },
            records: []
        };
        
        // 创建CSV文件头
        const csvHeader = '用户名,消息发送人名称,语音ID,滑动百分比,时间,IP地址,操作方式\n';
        
        try {
            fs.writeFileSync(jsonPath, JSON.stringify(jsonHeader, null, 2), 'utf8');
            fs.writeFileSync(csvPath, csvHeader, 'utf8');
            console.log(`✅ 创建文件: ${jsonPath}`);
            console.log(`✅ 创建文件: ${csvPath}`);
        } catch (error) {
            console.error('❌ 创建文件失败:', error);
        }
    }

    // 记录滑动数据
    logSlideData(ip, percentage, operationType = '网页') {
        const session = this.activeSessions.get(ip);
        if (!session) {
            console.log('⚠️ 没有活跃会话，跳过记录');
            return;
        }
        
        const timestamp = new Date().toISOString();
        const record = {
            username: session.username,
            sender: session.sender,
            fileId: session.fileId,
            percentage: percentage.toFixed(2),
            timestamp,
            ip,
            operationType
        };
        
        // 写入JSON文件
        this.appendToJson(session.username, session.sessionId, record);
        
        // 写入CSV文件
        this.appendToCsv(session.username, session.sessionId, record);
        
        console.log(`📊 记录滑动数据: ${session.username} -> ${session.sender} ${percentage.toFixed(2)}%`);
    }

    // 追加到JSON文件
    appendToJson(username, sessionId, record) {
        try {
            const userDir = path.join(this.outputPath, username);
            const jsonPath = path.join(userDir, `${sessionId}.json`);
            
            if (fs.existsSync(jsonPath)) {
                const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                data.records.push(record);
                fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
            }
        } catch (error) {
            console.error('❌ 写入JSON文件失败:', error);
        }
    }

    // 追加到CSV文件
    appendToCsv(username, sessionId, record) {
        try {
            const userDir = path.join(this.outputPath, username);
            const csvPath = path.join(userDir, `${sessionId}.csv`);
            
            if (fs.existsSync(csvPath)) {
                const csvLine = `${record.username},${record.sender},${record.fileId},${record.percentage},${record.timestamp},${record.ip},${record.operationType}\n`;
                fs.appendFileSync(csvPath, csvLine, 'utf8');
            }
        } catch (error) {
            console.error('❌ 写入CSV文件失败:', error);
        }
    }

    // 获取当前活跃会话
    getActiveSession(ip) {
        return this.activeSessions.get(ip);
    }

    // 获取所有活跃会话
    getAllActiveSessions() {
        return Array.from(this.activeSessions.entries());
    }

    // 清理过期的会话（可选功能）
    cleanupExpiredSessions(maxAgeHours = 24) {
        const now = new Date();
        const maxAge = maxAgeHours * 60 * 60 * 1000; // 转换为毫秒
        
        for (const [ip, session] of this.activeSessions.entries()) {
            if (now - session.startTime > maxAge) {
                console.log(`🧹 清理过期会话: ${session.username} -> ${session.sender} [${session.sessionId}]`);
                this.activeSessions.delete(ip);
            }
        }
    }
}

module.exports = UserBehaviorLogger;
