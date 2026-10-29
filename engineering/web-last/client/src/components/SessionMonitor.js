import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiUser, FiActivity, FiClock, FiMapPin, FiDatabase } from 'react-icons/fi';
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

const SessionsContainer = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  overflow: hidden;
`;

const SessionsHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SessionsTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const SessionItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
`;

const SessionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const SessionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin-top: 8px;
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
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
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

const SessionMonitor = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/slide-data/sessions/active`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.activeSessions || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('获取活跃会话失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
    
    // 每5秒自动刷新
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return '未知';
    try {
      return new Date(timestamp).toLocaleString('zh-CN');
    } catch {
      return timestamp;
    }
  };

  const getDuration = (startTime) => {
    if (!startTime) return '未知';
    try {
      const start = new Date(startTime);
      const now = new Date();
      const diff = now - start;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}分${seconds}秒`;
    } catch {
      return '未知';
    }
  };

  const stats = {
    totalSessions: sessions.length,
    activeExperiments: sessions.reduce((count, session) => count + (session.experiments?.length || 0), 0),
    totalUsers: new Set(sessions.map(s => s.userName)).size,
    sources: [...new Set(sessions.map(s => s.source))].length
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
          <RefreshBtn onClick={fetchSessions} disabled={loading}>
            <FiRefreshCw style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            刷新
          </RefreshBtn>
        </div>
      </Header>

      <StatsContainer>
        <StatCard>
          <StatIcon color="#007aff">
            <FiUser />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.totalSessions}</StatValue>
            <StatLabel>活跃会话</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#28a745">
            <FiActivity />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.activeExperiments}</StatValue>
            <StatLabel>进行中实验</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#ffc107">
            <FiUser />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.totalUsers}</StatValue>
            <StatLabel>活跃用户</StatLabel>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon color="#17a2b8">
            <FiMapPin />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.sources}</StatValue>
            <StatLabel>数据源类型</StatLabel>
          </StatContent>
        </StatCard>
      </StatsContainer>

      <SessionsContainer>
        <SessionsHeader>
          <SessionsTitle>活跃会话详情</SessionsTitle>
          {loading && <LoadingSpinner />}
        </SessionsHeader>

        {sessions.length === 0 ? (
          <EmptyState>
            <FiDatabase size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <div>暂无活跃会话</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              开始一个用户会话或实验后，这里会显示实时状态
            </div>
          </EmptyState>
        ) : (
          sessions.map((session, index) => (
            <SessionItem key={`${session.ip}-${index}`}>
              <SessionHeader>
                <SessionInfo>
                  <FiUser size={16} />
                  <strong>{session.userName || '未知用户'}</strong>
                  <SessionStatus active={true}>活跃</SessionStatus>
                </SessionInfo>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  IP: {session.ip}
                </div>
              </SessionHeader>

              <SessionDetails>
                <DetailItem>
                  <FiMapPin size={12} />
                  数据源: {session.source || '未知'}
                </DetailItem>
                <DetailItem>
                  <FiClock size={12} />
                  开始时间: {formatTime(session.startTime)}
                </DetailItem>
                <DetailItem>
                  <FiActivity size={12} />
                  持续时间: {getDuration(session.startTime)}
                </DetailItem>
                <DetailItem>
                  <FiDatabase size={12} />
                  会话ID: {session.userSessionId || '未知'}
                </DetailItem>
              </SessionDetails>

              {session.experiments && session.experiments.length > 0 && (
                <ExperimentList>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
                    进行中的实验:
                  </div>
                  {session.experiments.map((exp, expIndex) => (
                    <ExperimentItem key={expIndex}>
                      <div>
                        <strong>{exp.experimentName}</strong>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                          开始: {formatTime(exp.startTime)} | 持续: {getDuration(exp.startTime)}
                        </div>
                      </div>
                      <SessionStatus active={true}>进行中</SessionStatus>
                    </ExperimentItem>
                  ))}
                </ExperimentList>
              )}
            </SessionItem>
          ))
        )}
      </SessionsContainer>
    </Container>
  );
};

export default SessionMonitor;
