import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import styled from 'styled-components';
import Login from './components/Login';
import Chat from './components/Chat';
import ContactList from './components/ContactList';
import config from './config'; // 导入配置文件
import SlideDataManager from './components/SlideDataManager';
import SessionMonitor from './components/SessionMonitor';
import SessionHistory from './components/SessionHistory';
import ServerAudioPicker from './components/ServerAudioPicker';
import './App.css';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

const App = () => {
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});

  useEffect(() => {
    // 检查本地存储的用户信息
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      // 创建Socket.IO连接
      const newSocket = io(config.socketUrl); // 使用配置文件中的地址
      setSocket(newSocket);

      // 用户身份识别
      newSocket.emit('identify', { userId: currentUser.id });

      // 监听服务器消息
      newSocket.on('server_message', (data) => {
        if (data.type === 'new_message' || data.type === 'new_voice_message' || data.type === 'new_file_message') {
          const { message } = data;
          setMessages(prev => ({
            ...prev,
            [message.senderId]: [...(prev[message.senderId] || []), message]
          }));
        } else if (data.type === 'user_typing') {
          // 处理用户正在输入状态
        }
      });

      // 监听消息发送确认
      newSocket.on('message_sent', (data) => {
        if (data.type === 'message_ack' || data.type === 'voice_message_ack' || data.type === 'file_message_ack') {
          const { message } = data;
          // 修复：消息应该添加到发送者的消息列表中，而不是接收者
          const targetUserId = message.senderId || selectedUser?.id;
          setMessages(prev => ({
            ...prev,
            [targetUserId]: [...(prev[targetUserId] || []), message]
          }));
        }
      });

      // 监听新消息事件（用于接收其他用户发送的消息）
      newSocket.on('new_message', (message) => {
        setMessages(prev => ({
          ...prev,
          [message.senderId]: [...(prev[message.senderId] || []), message]
        }));
      });

      // 监听用户状态变化
      newSocket.on('user_status_change', (data) => {
        setUsers(prev => prev.map(user => 
          user.id === data.userId 
            ? { ...user, online: data.online }
            : user
        ));
      });

      // 加载用户列表
      fetchUsers();

      return () => {
        newSocket.close();
      };
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/users?excludeUserId=${currentUser?.id}`);
      if (response.ok) {
        const users = await response.json();
        setUsers(users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/messages/${userId}`);
      if (response.ok) {
        const messages = await response.json();
        setMessages(prev => ({
          ...prev,
          [userId]: messages
        }));
      }
    } catch (error) {
      console.error('获取消息失败:', error);
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSocket(null);
    setUsers([]);
    setSelectedUser(null);
    setMessages({});
    localStorage.removeItem('currentUser');
  };

  const handleSendMessage = (content, type = 'text') => {
    if (!selectedUser || !socket) return;

    // 检查是否是音频消息
    if (content === '__AUDIO_MESSAGE__' && type && type.id) {
      // 这是一个音频消息，直接添加到消息列表
      const audioMessage = type;
      setMessages(prev => ({
        ...prev,
        [selectedUser.id]: [...(prev[selectedUser.id] || []), audioMessage]
      }));
      return;
    }

    const messageData = {
      targetUserId: selectedUser.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderImg: currentUser.avatar || '',
      content,
      messageType: type
    };

    socket.emit('chat_message', messageData);
  };

  const handleSendVoiceMessage = (audioData, duration) => {
    if (!selectedUser || !socket) return;

    const voiceData = {
      targetUserId: selectedUser.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderImg: currentUser.avatar || '',
      audioData,
      duration
    };

    socket.emit('voice_message', voiceData);
  };

  const handleSendFile = (fileName, fileData, fileType) => {
    if (!selectedUser || !socket) return;

    const fileMessageData = {
      targetUserId: selectedUser.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderImg: currentUser.avatar || '',
      fileName,
      fileData,
      fileType
    };

    socket.emit('file_message', fileMessageData);
  };

  const loadMessages = async (userId) => {
    try {
      const response = await fetch(`/api/messages/${userId}`);
      const messageList = await response.json();
      setMessages(prev => ({
        ...prev,
        [userId]: messageList
      }));
    } catch (error) {
      console.error('获取消息失败:', error);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    if (!messages[user.id]) {
      loadMessages(user.id);
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppContainer>
        <Routes>
          <Route 
            path="/" 
            element={
              <div style={{ display: 'flex', height: '100%' }}>
                <ContactList 
                  users={users}
                  currentUser={currentUser}
                  selectedUser={selectedUser}
                  onUserSelect={handleUserSelect}
                  onLogout={handleLogout}
                />
                {selectedUser ? (
                  <Chat
                    currentUser={currentUser}
                    selectedUser={selectedUser}
                    messages={messages[selectedUser.id] || []}
                    onSendMessage={handleSendMessage}
                    onSendVoiceMessage={handleSendVoiceMessage}
                    onSendFile={handleSendFile}
                    socket={socket}
                  />
                ) : (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: '#f5f5f5'
                  }}>
                    <p style={{ color: '#999', fontSize: '16px' }}>
                      选择一个联系人开始聊天
                    </p>
                  </div>
                )}
              </div>
            } 
          />
          <Route path="/slide-data" element={<SlideDataManager />} />
          <Route path="/session-monitor" element={<SessionMonitor />} />
          <Route path="/session-history" element={<SessionHistory />} />
          <Route path="/server-audio" element={<ServerAudioPicker />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppContainer>
    </Router>
  );
};

export default App; 