import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiUser, FiActivity, FiClock, FiMapPin, FiDatabase, FiDownload } from 'react-icons/fi';
import config from '../config';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #f5f5f5;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #6c757d;
  color: #fff;
  cursor: pointer;
`;

const RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #007aff;
  color: #fff;
  cursor: pointer;
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`;

const StatCard = styled.div`
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: ${props => props.color || '#007aff'};
`;

const StatContent = styled.div`
  flex: 1;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #333;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #666;
`;

const HistoryContainer = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  overflow: hidden;
`;

const HistoryHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HistoryTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const UserSection = styled.div`
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
`;

const UserHeader = styled.div`
  padding: 16px;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #e0e0e0;
`;

const UserInfo = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
`;

const UserMeta = styled.div`
  font-size: 12px;
  color: #666;
  display: flex;
  gap: 16px;
`;

const SessionList = styled.div`
  padding: 16px;
`;

const SessionItem = styled.div`
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 12px;
  background: #fafafa;
`;

const SessionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const SessionId = styled.div`
  font-family: monospace;
  font-size: 12px;
  color: #666;
`;

const SessionStatus = styled.span`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => props.active ? '#d4edda' : '#f8d7da'};
  color: ${props => props.active ? '#155724' : '#721c24'};
`;

const SessionDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 8px;
`;

const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
`;

const ExperimentList = styled.div`
  margin-top: 8px;
  padding-left: 16px;
`;

const ExperimentItem = styled.div`
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 3px solid #007aff;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const SessionHistory = () => {
  const navigate = useNavigate();
  const [sessionHistory, setSessionHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchSessionHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/slide-data/sessions/history`);
      if (response.ok) {
        const data = await response.json();
        setSessionHistory(data.sessionHistory || {});
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('获取会话历史失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessionHistory();
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return '未知';
    try {
      return new Date(timestamp).toLocaleString('zh-CN');
    } catch {
      return timestamp;
    }
  };

  const getDuration = (startTime, endTime) => {
    if (!startTime) return '未知';
    try {
      const start = new Date(startTime);
      const end = endTime ? new Date(endTime) : new Date();
      const diff = end - start;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}分${seconds}秒`;
    } catch {
      return '未知';
    }
  };

  const stats = {
    totalUsers: Object.keys(sessionHistory).length,
    totalSessions: Object.values(sessionHistory).reduce((sum, user) => sum + (user.sessions?.length || 0), 0),
    activeSessions: Object.values(sessionHistory).reduce((sum, user) => 
      sum + (user.sessions?.filter(s => s.isActive).length || 0), 0),
    totalExperiments: Object.values(sessionHistory).reduce((sum, user) => 
      sum + (user.sessions?.reduce((sSum, session) => sSum + (session.experiments?.length || 0), 0) || 0), 0)
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(sessionHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `session_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container>
      <Header>
        <BackBtn onClick={() => navigate('/')}>
          <FiArrowLeft /> 返回聊天
        </BackBtn>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {lastUpdate && `最后更新: ${lastUpdate.toLocaleTimeString()}`}
          </span>
          <RefreshBtn onClick={fetchSessionHistory} disabled={loading}>
            <FiRefreshCw style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            刷新
          </RefreshBtn>
          <RefreshBtn onClick={exportHistory} style={{ background: '#28a745' }}>
            <FiDownload />
            导出
          </RefreshBtn>
        </div>
      </Header>

      <StatsContainer>
        <StatCard>
          <StatIcon color="#007aff">
            <FiUser />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.totalUsers}</StatValue>
            <StatLabel>总用户数</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#17a2b8">
            <FiDatabase />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.totalSessions}</StatValue>
            <StatLabel>总会话数</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#28a745">
            <FiActivity />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.activeSessions}</StatValue>
            <StatLabel>活跃会话</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#ffc107">
            <FiActivity />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.totalExperiments}</StatValue>
            <StatLabel>总实验数</StatLabel>
          </StatContent>
        </StatCard>
      </StatsContainer>

      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>会话历史记录</HistoryTitle>
          {loading && <LoadingSpinner />}
        </HistoryHeader>

        {Object.keys(sessionHistory).length === 0 ? (
          <EmptyState>
            <FiDatabase size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <div>暂无会话历史记录</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              开始用户会话后，这里会显示历史记录
            </div>
          </EmptyState>
        ) : (
          Object.entries(sessionHistory).map(([ip, userData]) => (
            <UserSection key={ip}>
              <UserHeader>
                <FiUser size={20} color="#007aff" />
                <UserInfo>
                  <UserName>{userData.userName || '未知用户'}</UserName>
                  <UserMeta>
                    <span>IP: {ip}</span>
                    <span>数据源: {userData.source || '未知'}</span>
                    <span>会话数: {userData.sessions?.length || 0}</span>
                  </UserMeta>
                </UserInfo>
              </UserHeader>

              <SessionList>
                {userData.sessions?.map((session, index) => (
                  <SessionItem key={index}>
                    <SessionHeader>
                      <SessionId>会话ID: {session.sessionId}</SessionId>
                      <SessionStatus active={session.isActive}>
                        {session.isActive ? '活跃' : '已结束'}
                      </SessionStatus>
                    </SessionHeader>

                    <SessionDetails>
                      <DetailItem>
                        <FiClock size={12} />
                        开始: {formatTime(session.startTime)}
                      </DetailItem>
                      <DetailItem>
                        <FiClock size={12} />
                        结束: {formatTime(session.endTime)}
                      </DetailItem>
                      <DetailItem>
                        <FiActivity size={12} />
                        持续: {getDuration(session.startTime, session.endTime)}
                      </DetailItem>
                      <DetailItem>
                        <FiMapPin size={12} />
                        路径: {session.userFolderPath?.split('/').pop() || '未知'}
                      </DetailItem>
                    </SessionDetails>

                    {session.experiments && session.experiments.length > 0 && (
                      <ExperimentList>
                        <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                          实验记录:
                        </div>
                        {session.experiments.map((exp, expIndex) => (
                          <ExperimentItem key={expIndex}>
                            <div>
                              <strong>{exp.experimentName}</strong>
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                开始: {formatTime(exp.startTime)} | 结束: {formatTime(exp.endTime)} | 
                                持续: {getDuration(exp.startTime, exp.endTime)}
                              </div>
                            </div>
                            <SessionStatus active={!exp.endTime}>
                              {exp.endTime ? '已结束' : '进行中'}
                            </SessionStatus>
                          </ExperimentItem>
                        ))}
                      </ExperimentList>
                    )}
                  </SessionItem>
                ))}
              </SessionList>
            </UserSection>
          ))
        )}
      </HistoryContainer>
    </Container>
  );
};

export default SessionHistory;
