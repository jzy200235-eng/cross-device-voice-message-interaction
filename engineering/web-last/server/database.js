const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.dataPath = path.join(__dirname, 'data');
        this.users = [];
        this.messages = {};
        this.friends = {}; // 好友关系表：userId -> [friendIds]
        this.onlineUsers = new Map(); // userId -> {socket, userInfo}
        
        // 确保数据目录存在
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
        
        this.loadData();
    }

    // 加载数据
    loadData() {
        try {
            // 加载用户数据
            const usersPath = path.join(this.dataPath, 'users.json');
            if (fs.existsSync(usersPath)) {
                this.users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            }

            // 加载消息数据
            const messagesPath = path.join(this.dataPath, 'messages.json');
            if (fs.existsSync(messagesPath)) {
                this.messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
            }

            // 加载好友关系数据
            const friendsPath = path.join(this.dataPath, 'friends.json');
            if (fs.existsSync(friendsPath)) {
                this.friends = JSON.parse(fs.readFileSync(friendsPath, 'utf8'));
            }
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    // 保存数据到文件
    saveData() {
        try {
            // 保存用户数据
            const usersPath = path.join(this.dataPath, 'users.json');
            fs.writeFileSync(usersPath, JSON.stringify(this.users, null, 2));

            // 保存消息数据
            const messagesPath = path.join(this.dataPath, 'messages.json');
            fs.writeFileSync(messagesPath, JSON.stringify(this.messages, null, 2));

            // 保存好友关系数据
            const friendsPath = path.join(this.dataPath, 'friends.json');
            fs.writeFileSync(friendsPath, JSON.stringify(this.friends, null, 2));
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }

    // 根据用户名查找用户
    getUserByUsername(username) {
        return this.users.find(user => user.username === username);
    }

    // 根据用户ID查找用户
    getUser(userId) {
        return this.users.find(user => user.id === userId);
    }

    // 创建新用户
    createUser(username) {
        // 检查用户名是否已存在
        const existingUser = this.getUserByUsername(username);
        if (existingUser) {
            return existingUser;
        }

        const newUser = {
            id: Date.now().toString(),
            username: username,
            name: username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            online: false,
            lastSeen: new Date().toISOString(),
            count: 0,
            createdAt: new Date().toISOString()
        };
        
        this.users.push(newUser);
        this.saveData();
        return newUser;
    }

    // 获取所有用户（除了当前用户）
    getUsers(excludeUserId = null) {
        return this.users
            .filter(user => user.id !== excludeUserId)
            .map(user => ({
                ...user,
                online: this.onlineUsers.has(user.id)
            }));
    }

    // 获取聊天消息
    getMessages(userId) {
        // 只返回当前用户的消息
        return this.messages[userId] || [];
    }

    // 添加消息
    addMessage(userId, message) {
        if (!this.messages[userId]) {
            this.messages[userId] = [];
        }
        
        const newMessage = {
            id: `msg_${userId}_${Date.now()}`,
            ...message,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleString('zh-CN', {
                year: '2-digit',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(/\//g, '/')
        };
        
        // 如果是语音消息，解析语音数据
        if (message.type === 'voice' && message.content) {
            try {
                const voiceData = JSON.parse(message.content);
                newMessage.content = message.content; // 保持原始JSON字符串
                newMessage.voiceData = voiceData; // 添加解析后的语音数据
            } catch (error) {
                console.error('解析语音消息数据失败:', error);
                newMessage.content = message.content;
            }
        }
        
        this.messages[userId].push(newMessage);
        
        // 更新用户最后消息
        const user = this.getUser(userId);
        if (user) {
            user.lastMessage = message.content;
            user.lastMessageTime = newMessage.timestamp;
        }
        
        this.saveData();
        return newMessage;
    }

    // 添加预处理的音频消息（用于导入数据）
    addPreprocessedMessage(userId, message) {
        if (!this.messages[userId]) {
            this.messages[userId] = [];
        }
        
        this.messages[userId].push(message);
        this.saveData();
        return message;
    }

    // 获取用户的好友列表
    getFriends(userId) {
        const friendIds = this.friends[userId] || [];
        return friendIds.map(friendId => this.getUser(friendId)).filter(Boolean);
    }

    // 添加好友关系
    addFriend(userId, friendId) {
        if (!this.friends[userId]) {
            this.friends[userId] = [];
        }
        if (!this.friends[friendId]) {
            this.friends[friendId] = [];
        }
        
        // 双向添加好友关系
        if (!this.friends[userId].includes(friendId)) {
            this.friends[userId].push(friendId);
        }
        if (!this.friends[friendId].includes(userId)) {
            this.friends[friendId].push(userId);
        }
        
        this.saveData();
    }

    // 用户上线
    userOnline(userId, socket, userInfo) {
        this.onlineUsers.set(userId, { socket, userInfo });
        
        // 更新用户状态
        const user = this.getUser(userId);
        if (user) {
            user.online = true;
            user.lastSeen = new Date().toISOString();
        }
        
        this.saveData();
    }

    // 用户下线
    userOffline(userId) {
        this.onlineUsers.delete(userId);
        
        // 更新用户状态
        const user = this.getUser(userId);
        if (user) {
            user.online = false;
            user.lastSeen = new Date().toISOString();
        }
        
        this.saveData();
    }

    // 获取在线用户
    getOnlineUsers() {
        return Array.from(this.onlineUsers.keys());
    }

    // 广播消息给所有在线用户
    broadcast(message, excludeUserId = null) {
        this.onlineUsers.forEach((userData, userId) => {
            if (userId !== excludeUserId && userData.socket.connected) {
                userData.socket.emit('broadcast', message);
            }
        });
    }

    // 发送消息给特定用户
    sendToUser(userId, message) {
        const userData = this.onlineUsers.get(userId);
        if (userData && userData.socket.connected) {
            userData.socket.emit('server_message', message);
        }
    }

    // 重置消息计数
    resetMessageCount(userId) {
        const user = this.getUser(userId);
        if (user) {
            user.count = 0;
            this.saveData();
        }
    }

    // 删除用户数据
    deleteUserData(userId) {
        // 删除用户
        this.users = this.users.filter(user => user.id !== userId);
        
        // 删除用户的消息
        delete this.messages[userId];
        
        // 删除好友关系
        delete this.friends[userId];
        Object.keys(this.friends).forEach(friendId => {
            this.friends[friendId] = this.friends[friendId].filter(id => id !== userId);
        });
        
        this.saveData();
    }

    // 清空所有数据
    clearAllData() {
        this.users = [];
        this.messages = {};
        this.friends = {};
        this.onlineUsers.clear();
        this.saveData();
        console.log('所有数据已清空');
    }

    // 获取音频消息统计
    getAudioMessageStats() {
        const stats = {
            totalMessages: 0,
            audioMessages: 0,
            usersWithAudio: 0,
            totalDuration: 0,
            averageDuration: 0
        };

        Object.values(this.messages).forEach(userMessages => {
            userMessages.forEach(message => {
                stats.totalMessages++;
                if (message.type === 'voice') {
                    stats.audioMessages++;
                    if (message.audioMetadata && message.audioMetadata.audio_duration_sec) {
                        stats.totalDuration += message.audioMetadata.audio_duration_sec;
                    }
                }
            });
        });

        if (stats.audioMessages > 0) {
            stats.averageDuration = stats.totalDuration / stats.audioMessages;
        }

        // 统计有音频消息的用户
        Object.keys(this.messages).forEach(userId => {
            const userMessages = this.messages[userId];
            if (userMessages.some(msg => msg.type === 'voice')) {
                stats.usersWithAudio++;
            }
        });

        return stats;
    }

    // 获取音频消息列表
    getAudioMessages(userId = null) {
        const audioMessages = [];
        
        if (userId) {
            // 获取特定用户的音频消息
            const userMessages = this.messages[userId] || [];
            userMessages.forEach(message => {
                if (message.type === 'voice') {
                    audioMessages.push(message);
                }
            });
        } else {
            // 获取所有音频消息
            Object.values(this.messages).forEach(userMessages => {
                userMessages.forEach(message => {
                    if (message.type === 'voice') {
                        audioMessages.push(message);
                    }
                });
            });
        }

        return audioMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
}

module.exports = Database; 