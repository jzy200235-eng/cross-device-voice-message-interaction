const fs = require('fs');
const path = require('path');

class SlideDataManager {
    constructor() {
        this.basePath = path.join(__dirname, 'slidedata');
        this.mobileWebPath = path.join(this.basePath, 'mobile_web');
        this.desktopWebPath = path.join(this.basePath, 'desktop_web');
        this.hardwareSensorPath = path.join(this.basePath, 'hardware_sensor');
        this.ensureDirectories();
        this.activeSessions = new Map();
        this.hardwareTimestamps = new Map();
        this.mobileTimestamps = new Map();
        this.loadHardwareTimestamps();
        this.loadMobileTimestamps();
        this.loadActiveSessions();
        
        // 定期保存活跃会话状态（每30秒）
        this.saveInterval = setInterval(() => {
            if (this.activeSessions.size > 0) {
                this.saveActiveSessionsConfig();
            }
        }, 30000);
    }

    ensureDirectories() {
        const paths = [this.basePath, this.mobileWebPath, this.desktopWebPath, this.hardwareSensorPath];
        paths.forEach(dirPath => {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }

    getBeijingTime() {
        const now = new Date();
        return now;
    }

    getBeijingTimeISO() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+08:00`;
    }

    formatTimestamp(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
    }

    sanitizeIPForFilename(ip) {
        if (!ip) return 'unknown';
        if (ip.includes(':')) {
            return ip.replace(/:/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        return ip.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    startUserSession(ip, source, userName) {
        try {
            console.log('🚀 开始用户会话 - 数据源:', source, '用户名:', userName);
            
            // 使用用户名+数据源作为唯一标识
            const sessionKey = `${userName}_${source}`;
            console.log('🔧 会话标识:', sessionKey);
            console.log('📋 当前活跃会话:', Array.from(this.activeSessions.keys()));
            
            if (this.activeSessions.has(sessionKey)) {
                console.log('❌ 该用户在此数据源已有活跃会话:', sessionKey);
                return { success: false, error: `用户 ${userName} 在 ${source} 已有活跃会话` };
            }
            
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const safeUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const userFolderName = `${timestamp}_${safeUserName}_${source}`;
            const userFolderPath = path.join(this.getSourcePath(source), userFolderName);
            
            if (!fs.existsSync(userFolderPath)) {
                fs.mkdirSync(userFolderPath, { recursive: true });
            }
            
            const totalCsvPath = path.join(userFolderPath, 'total.csv');
            const header = 'timestamp,event_type,user_name,experiment_name,position,source\n';
            const userStartRecord = `${timestamp},user_start,${userName},,,"${source}"\n`;
            fs.writeFileSync(totalCsvPath, header + userStartRecord, 'utf8');
            
            const session = { 
                userName, 
                startTime: timestamp, 
                userFolderPath, 
                userSessionId: userFolderName, 
                source, 
                experiments: [],
                sessionKey
            };
            
            this.activeSessions.set(sessionKey, session);
            console.log('✅ 会话已添加到活跃会话:', sessionKey, session);
            this.saveActiveSessionsConfig(); // 保存到文件
            console.log('💾 活跃会话配置已保存');
            return { success: true, sessionId: userFolderName, userFolderPath };
        } catch (e) {
            console.error('❌ 开始用户会话失败:', e);
            return { success: false, error: e.message };
        }
    }

    endUserSession(ip, source) {
        try {
            console.log('🛑 结束用户会话 - 数据源:', source);
            
            // 查找该数据源的活跃会话
            let session = null;
            let sessionKey = null;
            
            for (const [key, sess] of this.activeSessions.entries()) {
                if (sess.source === source) {
                    session = sess;
                    sessionKey = key;
                    break;
                }
            }
            
            if (!session) {
                console.log('❌ 该数据源没有活跃会话:', source);
                return { success: false, error: `数据源 ${source} 没有活跃会话` };
            }
            
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const endTimeISO = this.getBeijingTimeISO();
            
            // 记录到CSV文件
            const totalCsvPath = path.join(session.userFolderPath, 'total.csv');
            const endRecord = `${timestamp},user_end,${session.userName},,,"${source}"\n`;
            fs.appendFileSync(totalCsvPath, endRecord, 'utf8');
            
            // 更新会话历史记录
            this.updateSessionHistoryOnEnd(sessionKey, session.userSessionId, endTimeISO);
            
            // 从活跃会话中移除
            this.activeSessions.delete(sessionKey);
            this.saveActiveSessionsConfig(); // 保存到文件
            
            console.log('✅ 用户会话已结束:', sessionKey, session.userName);
            return { success: true };
        } catch (e) {
            console.error('❌ 结束用户会话失败:', e);
            return { success: false, error: e.message };
        }
    }

    startExperiment(ip, source, experimentName) {
        try {
            console.log('🧪 开始实验 - 数据源:', source, '实验名称:', experimentName);
            
            // 查找该数据源的活跃会话
            let session = null;
            let sessionKey = null;
            
            for (const [key, sess] of this.activeSessions.entries()) {
                if (sess.source === source) {
                    session = sess;
                    sessionKey = key;
                    break;
                }
            }
            
            if (!session) {
                console.log('❌ 该数据源没有活跃的用户会话:', source);
                return { success: false, error: `数据源 ${source} 没有活跃的用户会话` };
            }
            
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const safeExperimentName = experimentName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const experimentId = `${timestamp}_${safeExperimentName}`;
            const experimentFolderPath = path.join(session.userFolderPath, experimentId);
            
            if (!fs.existsSync(experimentFolderPath)) {
                fs.mkdirSync(experimentFolderPath, { recursive: true });
            }
            
            const positionCsvPath = path.join(experimentFolderPath, 'position.csv');
            const positionCsvHeader = 'timestamp,position,source,user_name,experiment_name\n';
            if (!fs.existsSync(positionCsvPath)) fs.writeFileSync(positionCsvPath, positionCsvHeader, 'utf8');
            
            const buttonTimeCsvPath = path.join(experimentFolderPath, 'button_time.csv');
            const buttonTimeCsvHeader = 'timestamp,event_type,experiment_name,user_name,source\n';
            if (!fs.existsSync(buttonTimeCsvPath)) fs.writeFileSync(buttonTimeCsvPath, buttonTimeCsvHeader, 'utf8');
            
            const startRecord = `${timestamp},experiment_start,${experimentName},${session.userName},"${source}"\n`;
            fs.appendFileSync(buttonTimeCsvPath, startRecord, 'utf8');
            
            const totalCsvPath = path.join(session.userFolderPath, 'total.csv');
            const totalRecord = `${timestamp},experiment_start,${session.userName},${experimentName},,"${source}"\n`;
            fs.appendFileSync(totalCsvPath, totalRecord, 'utf8');
            
            session.experiments.push({ experimentId, experimentName, startTime: timestamp, experimentFolderPath });
            this.saveActiveSessionsConfig(); // 保存到文件
            
            console.log('✅ 实验已开始:', experimentName, '用户:', session.userName);
            return { success: true, experimentId, experimentFolderPath };
        } catch (e) {
            console.error('❌ 开始实验失败:', e);
            return { success: false, error: e.message };
        }
    }

    endExperiment(ip, source) {
        try {
            let normalizedIP = ip;
            if (ip === '::1') normalizedIP = '127.0.0.1';
            else if (ip.startsWith('::ffff:')) normalizedIP = ip.substring(7);
            let session = this.activeSessions.get(ip) || this.activeSessions.get(normalizedIP);
            if (!session) return { success: false, error: `IP ${normalizedIP} 没有活跃会话` };
            if (session.experiments.length === 0) return { success: false, error: '没有活跃的实验会话' };
            
            const currentExperiment = session.experiments[session.experiments.length - 1];
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const endTimeISO = this.getBeijingTimeISO();
            
            // 记录到CSV文件
            const buttonTimeCsvPath = path.join(currentExperiment.experimentFolderPath, 'button_time.csv');
            const endRecord = `${timestamp},experiment_end,${currentExperiment.experimentName},${session.userName},"${source}","${normalizedIP}"\n`;
            fs.appendFileSync(buttonTimeCsvPath, endRecord, 'utf8');
            const totalCsvPath = path.join(session.userFolderPath, 'total.csv');
            const totalRecord = `${timestamp},experiment_end,${session.userName},${currentExperiment.experimentName},,"${source}","${normalizedIP}"\n`;
            fs.appendFileSync(totalCsvPath, totalRecord, 'utf8');
            
            // 更新实验历史记录
            this.updateExperimentHistoryOnEnd(normalizedIP, session.userSessionId, currentExperiment.experimentId, endTimeISO);
            
            const finished = session.experiments.pop();
            this.saveActiveSessionsConfig(); // 保存到文件
            
            console.log('✅ 实验已结束:', currentExperiment.experimentName, '用户:', session.userName);
            // 返回额外信息，便于上层进行范围复制
            return { success: true, experimentFolderPath: finished?.experimentFolderPath, startTimeIso: finished?.startTime, userName: session.userName, experimentName: currentExperiment.experimentName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    forceEndExperiment(ip, source) {
        try {
            const normalizedIP = ip === '::1' ? '127.0.0.1' : ip;
            const session = this.activeSessions.get(normalizedIP);
            if (!session) return { success: false, error: `IP ${normalizedIP} 没有活跃会话` };
            if (session.experiments.length === 0) return { success: false, error: '没有活跃的实验会话' };
            const currentExperiment = session.experiments[session.experiments.length - 1];
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const buttonTimeCsvPath = path.join(currentExperiment.experimentFolderPath, 'button_time.csv');
            const forceEndRecord = `${timestamp},experiment_force_end,${session.userName},${currentExperiment.experimentName},,"${source}","${normalizedIP}"\n`;
            fs.appendFileSync(buttonTimeCsvPath, forceEndRecord, 'utf8');
            const totalCsvPath = path.join(session.userFolderPath, 'total.csv');
            const totalForceEndRecord = `${timestamp},experiment_force_end,${session.userName},${currentExperiment.experimentName},,"${source}","${normalizedIP}"\n`;
            fs.appendFileSync(totalCsvPath, totalForceEndRecord, 'utf8');
            session.experiments.pop();
            this.saveActiveSessionsConfig(); // 保存到文件
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    getActiveSession(ip) {
        return this.activeSessions.get(ip);
    }

    getAllActiveSessions() {
        console.log('📋 获取所有活跃会话 - 当前Map大小:', this.activeSessions.size);
        console.log('📋 活跃会话Map内容:', Array.from(this.activeSessions.entries()));
        const result = Array.from(this.activeSessions.entries()).map(([sessionKey, session]) => ({ 
            sessionKey,
            source: session.source,
            userName: session.userName,
            startTime: session.startTime,
            experiments: session.experiments,
            userSessionId: session.userSessionId
        }));
        console.log('📋 返回的活跃会话数据:', result);
        return result;
    }

    getSourcePath(source) {
        switch (source) {
            case 'mobile_web':
                return this.mobileWebPath;
            case 'desktop_web':
                return this.desktopWebPath;
            case 'hardware_sensor':
                return this.hardwareSensorPath;
            default:
                throw new Error(`未知的数据源: ${source}`);
        }
    }

    saveActiveSessionsConfig() {
        try {
            console.log('💾 开始保存活跃会话配置 - 当前会话数:', this.activeSessions.size);
            const configData = { 
                timestamp: this.getBeijingTimeISO(), 
                activeSessions: [],
                fullSessions: {},
                sessionHistory: this.loadSessionHistory() // 加载历史记录
            };
            
            // 保存完整会话数据用于持久化
            for (const [ip, session] of this.activeSessions.entries()) {
                const sessionData = {
                    userName: session.userName,
                    startTime: session.startTime,
                    userFolderPath: session.userFolderPath,
                    userSessionId: session.userSessionId,
                    source: session.source,
                    experiments: session.experiments,
                    isActive: true,
                    lastUpdate: this.getBeijingTimeISO()
                };
                
                configData.fullSessions[ip] = sessionData;
                
                // 更新会话历史记录
                this.updateSessionHistory(ip, sessionData);
                
                // 保存简化数据用于串口监听器和前端显示
                configData.activeSessions.push({
                    ip,
                    userSessionId: session.userSessionId || session.userFolderPath?.split(path.sep).pop(),
                    userName: session.userName,
                    startTime: session.startTime,
                    source: session.source,
                    experiments: session.experiments,
                    // 如果有活跃实验，添加实验信息
                    ...(session.experiments.length > 0 && {
                        experimentId: session.experiments[session.experiments.length - 1].experimentId,
                        experimentName: session.experiments[session.experiments.length - 1].experimentName,
                        experimentStartTime: session.experiments[session.experiments.length - 1].startTime
                    })
                });
            }
            
            // 保存到主配置文件
            const configPath = path.join(this.basePath, 'active_sessions_config.json');
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
            
            // 保存到会话历史文件
            this.saveSessionHistory(configData.sessionHistory);
            
            console.log('💾 活跃会话已保存到文件:', configPath);
            console.log('💾 会话历史已更新');
        } catch (e) {
            console.error('❌ 保存活跃会话配置失败:', e.message);
        }
    }

    loadActiveSessions() {
        try {
            const configPath = path.join(this.basePath, 'active_sessions_config.json');
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                const data = JSON.parse(content);
                
                if (data.fullSessions) {
                    this.activeSessions = new Map();
                    for (const [ip, sessionData] of Object.entries(data.fullSessions)) {
                        // 只加载活跃的会话
                        if (sessionData.isActive !== false) {
                            this.activeSessions.set(ip, sessionData);
                        }
                    }
                    console.log('📂 从文件恢复活跃会话:', Array.from(this.activeSessions.keys()));
                }
            }
        } catch (e) {
            console.error('❌ 加载活跃会话失败:', e.message);
            this.activeSessions = new Map();
        }
    }

    // 会话历史记录管理
    loadSessionHistory() {
        try {
            const historyPath = path.join(this.basePath, 'session_history.json');
            if (fs.existsSync(historyPath)) {
                const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                return data.sessions || {};
            }
        } catch (e) {
            console.error('加载会话历史失败:', e.message);
        }
        return {};
    }

    saveSessionHistory(sessionHistory) {
        try {
            const historyPath = path.join(this.basePath, 'session_history.json');
            const historyData = {
                timestamp: this.getBeijingTimeISO(),
                sessions: sessionHistory
            };
            fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2), 'utf8');
        } catch (e) {
            console.error('保存会话历史失败:', e.message);
        }
    }

    updateSessionHistory(ip, sessionData) {
        try {
            const history = this.loadSessionHistory();
            if (!history[ip]) {
                history[ip] = {
                    userName: sessionData.userName,
                    source: sessionData.source,
                    sessions: []
                };
            }
            
            // 添加当前会话记录
            const sessionRecord = {
                sessionId: sessionData.userSessionId,
                startTime: sessionData.startTime,
                endTime: null,
                userFolderPath: sessionData.userFolderPath,
                experiments: sessionData.experiments.map(exp => ({
                    experimentId: exp.experimentId,
                    experimentName: exp.experimentName,
                    startTime: exp.startTime,
                    endTime: null,
                    experimentFolderPath: exp.experimentFolderPath
                })),
                isActive: sessionData.isActive,
                lastUpdate: sessionData.lastUpdate
            };
            
            // 检查是否已存在相同的会话ID
            const existingIndex = history[ip].sessions.findIndex(s => s.sessionId === sessionData.userSessionId);
            if (existingIndex >= 0) {
                history[ip].sessions[existingIndex] = sessionRecord;
            } else {
                history[ip].sessions.push(sessionRecord);
            }
            
            return history;
        } catch (e) {
            console.error('更新会话历史失败:', e.message);
            return this.loadSessionHistory();
        }
    }

    updateSessionHistoryOnEnd(ip, sessionId, endTime) {
        try {
            const history = this.loadSessionHistory();
            if (history[ip] && history[ip].sessions) {
                const sessionIndex = history[ip].sessions.findIndex(s => s.sessionId === sessionId);
                if (sessionIndex >= 0) {
                    history[ip].sessions[sessionIndex].endTime = endTime;
                    history[ip].sessions[sessionIndex].isActive = false;
                    history[ip].sessions[sessionIndex].lastUpdate = endTime;
                    
                    // 同时结束所有未结束的实验
                    history[ip].sessions[sessionIndex].experiments.forEach(exp => {
                        if (!exp.endTime) {
                            exp.endTime = endTime;
                        }
                    });
                    
                    this.saveSessionHistory(history);
                    console.log('📝 会话历史已更新 - 会话结束:', sessionId);
                }
            }
        } catch (e) {
            console.error('更新会话结束历史失败:', e.message);
        }
    }

    updateExperimentHistoryOnEnd(ip, sessionId, experimentId, endTime) {
        try {
            const history = this.loadSessionHistory();
            if (history[ip] && history[ip].sessions) {
                const sessionIndex = history[ip].sessions.findIndex(s => s.sessionId === sessionId);
                if (sessionIndex >= 0) {
                    const expIndex = history[ip].sessions[sessionIndex].experiments.findIndex(exp => exp.experimentId === experimentId);
                    if (expIndex >= 0) {
                        history[ip].sessions[sessionIndex].experiments[expIndex].endTime = endTime;
                        this.saveSessionHistory(history);
                        console.log('📝 实验历史已更新 - 实验结束:', experimentId);
                    }
                }
            }
        } catch (e) {
            console.error('更新实验结束历史失败:', e.message);
        }
    }

    recordHardwareTimestamp(ip, timestampType, timestamp, userName = null, experimentName = null) {
        try {
            if (!this.hardwareTimestamps) this.hardwareTimestamps = new Map();
            if (!this.hardwareTimestamps.has(ip)) {
                this.hardwareTimestamps.set(ip, { 
                    userStart: null, 
                    experimentStart: null, 
                    experimentEnd: null, 
                    userEnd: null,
                    userName: null,
                    experimentName: null
                });
            }
            const timestamps = this.hardwareTimestamps.get(ip);
            timestamps[timestampType] = timestamp;
            
            // 保存用户名和实验名（如果提供）
            if (userName !== null) {
                timestamps.userName = userName;
            }
            if (experimentName !== null) {
                timestamps.experimentName = experimentName;
            }
            
            this.hardwareTimestamps.set(ip, timestamps);
            this.saveHardwareTimestamps();
            console.log('💾 保存硬件时间戳:', { ip, timestampType, timestamp, userName, experimentName });
            return { success: true, timestamp };
        } catch (e) {
            console.error('❌ 记录硬件时间戳失败:', e.message);
            return { success: false, error: e.message };
        }
    }

    recordMobileTimestamp(ip, timestampType, timestamp, userName = null, experimentName = null) {
        try {
            if (!this.mobileTimestamps) this.mobileTimestamps = new Map();
            if (!this.mobileTimestamps.has(ip)) {
                this.mobileTimestamps.set(ip, { 
                    userStart: null, 
                    experimentStart: null, 
                    experimentEnd: null, 
                    userEnd: null,
                    userName: null,
                    experimentName: null
                });
            }
            const timestamps = this.mobileTimestamps.get(ip);
            timestamps[timestampType] = timestamp;
            
            // 保存用户名和实验名（如果提供）
            if (userName !== null) {
                timestamps.userName = userName;
            }
            if (experimentName !== null) {
                timestamps.experimentName = experimentName;
            }
            
            this.mobileTimestamps.set(ip, timestamps);
            this.saveMobileTimestamps();
            console.log('💾 保存手机时间戳:', { ip, timestampType, timestamp, userName, experimentName });
            return { success: true, timestamp };
        } catch (e) {
            console.error('❌ 记录手机时间戳失败:', e.message);
            return { success: false, error: e.message };
        }
    }

    saveHardwareTimestamps() {
        try {
            const data = { timestamp: this.getBeijingTimeISO(), hardwareTimestamps: {} };
            for (const [ip, timestamps] of this.hardwareTimestamps.entries()) {
                data.hardwareTimestamps[ip] = timestamps;
            }
            const configPath = path.join(this.basePath, 'hardware_timestamps.json');
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
            console.error('❌ 保存硬件时间戳失败:', e.message);
        }
    }

    loadHardwareTimestamps() {
        try {
            const configPath = path.join(this.basePath, 'hardware_timestamps.json');
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                const data = JSON.parse(content);
                this.hardwareTimestamps = new Map();
                for (const [ip, timestamps] of Object.entries(data.hardwareTimestamps)) {
                    this.hardwareTimestamps.set(ip, timestamps);
                }
            }
        } catch (e) {
            console.error('❌ 加载硬件时间戳失败:', e.message);
            this.hardwareTimestamps = new Map();
        }
    }

    saveMobileTimestamps() {
        try {
            const data = { timestamp: this.getBeijingTimeISO(), mobileTimestamps: {} };
            for (const [ip, timestamps] of this.mobileTimestamps.entries()) {
                data.mobileTimestamps[ip] = timestamps;
            }
            const configPath = path.join(this.basePath, 'mobile_timestamps.json');
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
            console.error('❌ 保存手机时间戳失败:', e.message);
        }
    }

    loadMobileTimestamps() {
        try {
            const configPath = path.join(this.basePath, 'mobile_timestamps.json');
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                const data = JSON.parse(content);
                this.mobileTimestamps = new Map();
                for (const [ip, timestamps] of Object.entries(data.mobileTimestamps)) {
                    this.mobileTimestamps.set(ip, timestamps);
                }
            }
        } catch (e) {
            console.error('❌ 加载手机时间戳失败:', e.message);
            this.mobileTimestamps = new Map();
        }
    }

    recordPosition(ip, source, position) {
        try {
            let normalizedIP = ip;
            if (ip === '::1') normalizedIP = '127.0.0.1';
            else if (ip.startsWith('::ffff:')) normalizedIP = ip.substring(7);
            
            // 首先尝试从活跃会话中获取信息
            let session = this.activeSessions.get(ip) || this.activeSessions.get(normalizedIP);
            const timestamp = this.getBeijingTimeISO();
            
            if (session && session.experiments.length > 0) {
                const currentExperiment = session.experiments[session.experiments.length - 1];
                const positionCsvPath = path.join(currentExperiment.experimentFolderPath, 'position.csv');
                const positionRecord = `${timestamp},${Number(position)},"${source}","${normalizedIP}","${session.userName}","${currentExperiment.experimentName}"\n`;
                if (!fs.existsSync(positionCsvPath)) {
                    const header = 'timestamp,position,source,ip,user_name,experiment_name\n';
                    fs.writeFileSync(positionCsvPath, header, 'utf8');
                }
                fs.appendFileSync(positionCsvPath, positionRecord, 'utf8');
                const totalCsvPath = path.join(session.userFolderPath, 'total.csv');
                const totalRecord = `${timestamp},position_update,${session.userName},${currentExperiment.experimentName},${Number(position)},"${source}","${normalizedIP}"\n`;
                fs.appendFileSync(totalCsvPath, totalRecord, 'utf8');
                return { success: true };
            }
            
            // 如果没有活跃会话，尝试从时间戳记录中获取用户名和实验名
            let userName = 'unknown';
            let experimentName = 'unknown';
            
            if (source === 'hardware' || source === 'hardware_sensor') {
                const timestamps = this.hardwareTimestamps.get(normalizedIP);
                if (timestamps) {
                    // 从时间戳记录中获取用户名和实验名
                    userName = timestamps.userName || 'hardware_user';
                    experimentName = timestamps.experimentName || 'hardware_experiment';
                    console.log('🔍 从硬件时间戳记录获取用户信息:', { userName, experimentName });
                } else {
                    console.log('⚠️ 未找到硬件时间戳记录，使用默认值');
                }
            } else if (source === 'mobile_web') {
                const timestamps = this.mobileTimestamps.get(normalizedIP);
                if (timestamps) {
                    // 从手机时间戳记录中获取用户名和实验名
                    userName = timestamps.userName || 'mobile_user';
                    experimentName = timestamps.experimentName || 'mobile_experiment';
                    console.log('🔍 从手机时间戳记录获取用户信息:', { userName, experimentName });
                } else {
                    console.log('⚠️ 未找到手机时间戳记录，使用默认值');
                }
            }
            
            const generalDir = path.join(this.basePath, source === 'hardware_sensor' ? 'hardware_sensor' : source, 'general_sliding');
            if (!fs.existsSync(generalDir)) fs.mkdirSync(generalDir, { recursive: true });
            const yyyy = new Date().getFullYear();
            const mm = String(new Date().getMonth() + 1).padStart(2, '0');
            const dd = String(new Date().getDate()).padStart(2, '0');
            const fileName = source === 'hardware_sensor' ? `hardware_sensor_sliding_data_${yyyy}-${mm}-${dd}.csv` : `${source}_sliding_data_${yyyy}-${mm}-${dd}.csv`;
            const csvPath = path.join(generalDir, fileName);
            if (!fs.existsSync(csvPath)) {
                const header = 'timestamp,position,source,ip,user_name,experiment_name\n';
                fs.writeFileSync(csvPath, header, 'utf8');
            }
            const record = `${timestamp},${Number(position)},${source},${normalizedIP},${userName},${experimentName}\n`;
            fs.appendFileSync(csvPath, record, 'utf8');
            console.log('📝 记录硬件滑动数据:', { timestamp, position, source, userName, experimentName });
            return { success: true };
        } catch (e) {
            console.error('❌ 记录位置数据失败:', e.message);
            return { success: false, error: e.message };
        }
    }

    // 处理硬件数据（根据时间戳自动分类到实验目录）
    processHardwareData(ip) {
        try {
            let normalizedIP = ip;
            if (ip === '::1') normalizedIP = '127.0.0.1';
            else if (ip.startsWith('::ffff:')) normalizedIP = ip.substring(7);
            
            console.log('🔍 处理硬件数据 - IP:', normalizedIP);
            
            const timestamps = this.hardwareTimestamps.get(normalizedIP);
            if (!timestamps) {
                console.log('❌ 没有找到硬件时间戳数据，当前时间戳:', Array.from(this.hardwareTimestamps.keys()));
                return { success: false, error: '没有找到硬件时间戳数据' };
            }
            
            console.log('📅 找到时间戳数据:', timestamps);
            
            const { userStart, experimentStart, experimentEnd, userEnd } = timestamps;
            if (!userStart || !experimentStart || !experimentEnd || !userEnd) {
                const missing = [];
                if (!userStart) missing.push('用户开始');
                if (!experimentStart) missing.push('实验开始');
                if (!experimentEnd) missing.push('实验结束');
                if (!userEnd) missing.push('用户结束');
                console.log('❌ 时间戳不完整，缺少:', missing);
                return { success: false, error: `硬件时间戳数据不完整，缺少: ${missing.join(', ')}` };
            }
            
            // 基于时间戳直接处理，不依赖活跃会话
            console.log('🔄 基于时间戳自动处理数据...');
            
            // 创建实验文件夹
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const userName = 'hardware_user'; // 可以从时间戳记录中获取，暂时使用默认值
            const experimentName = 'hardware_experiment'; // 可以从时间戳记录中获取，暂时使用默认值
            const safeUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const safeExperimentName = experimentName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const experimentFolderName = `${timestamp}_${safeUserName}_${safeExperimentName}`;
            const experimentFolderPath = path.join(this.hardwareSensorPath, experimentFolderName);
            
            if (!fs.existsSync(experimentFolderPath)) {
                fs.mkdirSync(experimentFolderPath, { recursive: true });
            }
            
            console.log('📁 创建实验文件夹:', experimentFolderPath);
            
            // 复制实验期间的数据
            const result = this.copyGeneralToExperiment(
                normalizedIP, 
                'hardware', // 使用 'hardware' 而不是 'hardware_sensor'，因为数据存储在 hardware/ 目录下
                experimentFolderPath, 
                experimentStart, 
                experimentEnd, 
                userName, 
                experimentName
            );
            
            console.log('📋 复制结果:', result);
            
            if (result.success) {
                // 清除时间戳
                this.hardwareTimestamps.delete(normalizedIP);
                this.saveHardwareTimestamps();
                console.log('✅ 硬件数据处理成功，复制了', result.copied, '条记录');
                return { success: true, processedData: result };
            } else {
                console.log('❌ 复制失败:', result.error);
                return result;
            }
        } catch (e) {
            console.log('❌ 处理硬件数据异常:', e.message);
            return { success: false, error: e.message };
        }
    }

    // 处理手机数据（根据时间戳自动分类到实验目录）
    processMobileData(ip) {
        try {
            let normalizedIP = ip;
            if (ip === '::1') normalizedIP = '127.0.0.1';
            else if (ip.startsWith('::ffff:')) normalizedIP = ip.substring(7);
            
            console.log('🔍 处理手机数据 - IP:', normalizedIP);
            
            const timestamps = this.mobileTimestamps.get(normalizedIP);
            if (!timestamps) {
                console.log('❌ 没有找到手机时间戳数据，当前时间戳:', Array.from(this.mobileTimestamps.keys()));
                return { success: false, error: '没有找到手机时间戳数据' };
            }
            
            console.log('📅 找到时间戳数据:', timestamps);
            
            const { userStart, experimentStart, experimentEnd, userEnd } = timestamps;
            if (!userStart || !experimentStart || !experimentEnd || !userEnd) {
                const missing = [];
                if (!userStart) missing.push('用户开始');
                if (!experimentStart) missing.push('实验开始');
                if (!experimentEnd) missing.push('实验结束');
                if (!userEnd) missing.push('用户结束');
                console.log('❌ 时间戳不完整，缺少:', missing);
                return { success: false, error: `手机时间戳数据不完整，缺少: ${missing.join(', ')}` };
            }
            
            // 基于时间戳直接处理，不依赖活跃会话
            console.log('🔄 基于时间戳自动处理数据...');
            
            // 创建实验文件夹
            const timestamp = this.formatTimestamp(this.getBeijingTime());
            const userName = timestamps.userName || 'mobile_user';
            const experimentName = timestamps.experimentName || 'mobile_experiment';
            const safeUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const safeExperimentName = experimentName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
            const experimentFolderName = `${timestamp}_${safeUserName}_${safeExperimentName}`;
            const experimentFolderPath = path.join(this.mobileWebPath, experimentFolderName);
            
            if (!fs.existsSync(experimentFolderPath)) {
                fs.mkdirSync(experimentFolderPath, { recursive: true });
            }
            
            console.log('📁 创建实验文件夹:', experimentFolderPath);
            
            // 复制实验期间的数据
            const result = this.copyGeneralToExperiment(
                normalizedIP, 
                'mobile_web',
                experimentFolderPath, 
                experimentStart, 
                experimentEnd, 
                userName, 
                experimentName
            );
            
            console.log('📋 复制结果:', result);
            
            if (result.success) {
                // 清除时间戳
                this.mobileTimestamps.delete(normalizedIP);
                this.saveMobileTimestamps();
                console.log('✅ 手机数据处理成功，复制了', result.copied, '条记录');
                return { success: true, processedData: result };
            } else {
                console.log('❌ 复制失败:', result.error);
                return result;
            }
        } catch (e) {
            console.log('❌ 处理手机数据异常:', e.message);
            return { success: false, error: e.message };
        }
    }

    // 将 general 区间内的数据复制到实验目录
    copyGeneralToExperiment(ip, source, experimentFolderPath, startIso, endIso, userName, experimentName) {
        try {
            const generalDir = path.join(this.basePath, source, 'general_sliding');
            console.log('🔍 查找general目录:', generalDir);
            console.log('🔍 目录是否存在:', fs.existsSync(generalDir));
            
            if (!fs.existsSync(generalDir)) {
                console.log('⚠️ general目录不存在，尝试创建:', generalDir);
                try {
                    fs.mkdirSync(generalDir, { recursive: true });
                    console.log('✅ general目录创建成功');
                } catch (e) {
                    console.log('❌ 创建general目录失败:', e.message);
                    return { success: false, error: '创建general目录失败' };
                }
            }
            
            const yyyy = new Date().getFullYear();
            const mm = String(new Date().getMonth() + 1).padStart(2, '0');
            const dd = String(new Date().getDate()).padStart(2, '0');
            const fileName = `${source}_sliding_data_${yyyy}-${mm}-${dd}.csv`;
            const csvPath = path.join(generalDir, fileName);
            
            console.log('🔍 查找CSV文件:', csvPath);
            console.log('🔍 文件是否存在:', fs.existsSync(csvPath));
            
            if (!fs.existsSync(csvPath)) {
                console.log('⚠️ general当日文件不存在，可能还没有滑动数据:', csvPath);
                return { success: true, copied: 0, message: '没有找到滑动数据文件，可能还没有进行滑动操作' };
            }
            const content = fs.readFileSync(csvPath, 'utf8').trim();
            const lines = content.split('\n');
            if (lines.length <= 1) return { success: true, copied: 0 };
            const header = lines[0];
            const rows = lines.slice(1);
            const startMs = Date.parse(startIso);
            const endMs = Date.parse(endIso);
            const filtered = rows.filter(line => {
                const ts = Date.parse(line.split(',')[0]);
                if (Number.isNaN(ts)) return false;
                if (!Number.isNaN(startMs) && ts < startMs) return false;
                if (!Number.isNaN(endMs) && ts > endMs) return false;
                return true;
            });
            const tsName = this.formatTimestamp(this.getBeijingTime());
            const outName = `${tsName}_${(userName||'user').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g,'_')}_${(experimentName||'exp').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g,'_')}`;
            const outCsv = path.join(experimentFolderPath, `${outName}.csv`);
            fs.writeFileSync(outCsv, header + '\n' + filtered.join('\n') + (filtered.length? '\n':''), 'utf8');
            return { success: true, copied: filtered.length, outCsv };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // 清理资源，保存最终状态
    cleanup() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        this.saveActiveSessionsConfig();
        this.saveHardwareTimestamps();
        console.log('🧹 SlideDataManager 已清理并保存最终状态');
    }
}

module.exports = SlideDataManager;


