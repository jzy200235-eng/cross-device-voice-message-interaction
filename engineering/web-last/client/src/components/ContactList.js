import React from 'react';
import styled from 'styled-components';
import { FiLogOut, FiUser, FiSliders, FiActivity, FiArchive } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  width: 300px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const UserName = styled.span`
  font-weight: 500;
  color: #333;
`;

const LogoutButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 5px;
  border-radius: 5px;
  
  &:hover {
    background: #f5f5f5;
  }
`;

const NavButton = styled(LogoutButton)``;

const ContactListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ContactItem = styled.div`
  padding: 15px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
  
  &:hover {
    background: #f8f9fa;
  }
  
  ${props => props.selected && `
    background: #e3f2fd;
    border-left: 3px solid #2196f3;
  `}
`;

const ContactAvatar = styled.img`
  width: 45px;
  height: 45px;
  border-radius: 50%;
  object-fit: cover;
`;

const ContactInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ContactName = styled.div`
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const OnlineIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.online ? '#4caf50' : '#ccc'};
`;

const LastMessage = styled.div`
  color: #666;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
  text-align: center;
`;

const ContactList = ({ users, currentUser, selectedUser, onUserSelect, onLogout }) => {
  const navigate = useNavigate();
  return (
    <Container>
      <Header>
        <UserInfo>
          <Avatar src={currentUser.avatar} alt={currentUser.name} />
          <UserName>{currentUser.name}</UserName>
        </UserInfo>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavButton onClick={() => navigate('/slide-data')} title="滑动数据管理">
            <FiSliders size={18} />
          </NavButton>
          <NavButton onClick={() => navigate('/session-monitor')} title="会话监控">
            <FiActivity size={18} />
          </NavButton>
          <NavButton onClick={() => navigate('/session-history')} title="会话历史">
            <FiArchive size={18} />
          </NavButton>
          <LogoutButton onClick={onLogout} title="退出登录">
            <FiLogOut size={18} />
          </LogoutButton>
        </div>
      </Header>
      
      <ContactListContainer>
        {users.length > 0 ? (
          users.map(user => (
            <ContactItem
              key={user.id}
              selected={selectedUser?.id === user.id}
              onClick={() => onUserSelect(user)}
            >
              <ContactAvatar src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} />
              <ContactInfo>
                <ContactName>
                  {user.name}
                  <OnlineIndicator online={user.online} />
                </ContactName>
                <LastMessage>
                  {user.lastMessage || '暂无消息'}
                </LastMessage>
              </ContactInfo>
            </ContactItem>
          ))
        ) : (
          <EmptyState>
            <FiUser size={48} />
            <p>暂无其他用户</p>
            <p style={{ fontSize: '12px' }}>其他用户登录后会显示在这里</p>
          </EmptyState>
        )}
      </ContactListContainer>
    </Container>
  );
};

export default ContactList; 