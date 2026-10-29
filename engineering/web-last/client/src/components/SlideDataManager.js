import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiPlay, FiSquare, FiX, FiArrowLeft, FiActivity } from 'react-icons/fi';
import config from '../config';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
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

const Section = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
`;

const Input = styled.input`
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
`;

const Button = styled.button`
  padding: 8px 12px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const DangerButton = styled(Button)`
  background: #dc3545;
`;

const WarnButton = styled(Button)`
  background: #ffc107;
  color: #212529;
`;

const Note = styled.div`
  font-size: 12px;
  color: #666;
`;

const Status = styled.div`
  font-size: 12px;
  color: #333;
`;

const SlideDataManager = () => {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('slideDataSessions');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      mobile_web: { userName: '', experimentName: '', isActive: false, isExperimentActive: false },
      desktop_web: { userName: '', experimentName: '', isActive: false, isExperimentActive: false },
      hardware_sensor: {
        userName: '',
        experimentName: '',
        isActive: false,
        isExperimentActive: false,
        timestamps: { userStart: null, experimentStart: null, experimentEnd: null, userEnd: null }
      }
    };
  });

  const [source, setSource] = useState('hardware_sensor');
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('slideDataSessions', JSON.stringify(sessions)); } catch (_) {}
  }, [sessions]);

  useEffect(() => { syncWithServer(); }, []);

  // 页面可见性变化时同步状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ 页面重新可见，同步服务端状态');
        syncWithServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 窗口焦点变化时同步状态
  useEffect(() => {
    const handleFocus = () => {
      console.log('🎯 窗口获得焦点，同步服务端状态');
      syncWithServer();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const post = async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const getClientIP = async () => {
    try {
      const r = await fetch(`${config.apiBaseUrl}/api/client-ip`);
      if (r.ok) {
        const data = await r.json();
        const ip = data.ip === '::1' ? '127.0.0.1' : (typeof data.ip === 'string' && data.ip.startsWith('::ffff:') ? data.ip.substring(7) : data.ip);
        return ip;
      }
    } catch (_) {}
    return '127.0.0.1';
  };

  const fetchActiveSessions = async () => {
    try {
      const r = await fetch(`${config.apiBaseUrl}/api/slide-data/sessions/active`);
      if (r.ok) { const data = await r.json(); return data.activeSessions || []; }
    } catch (_) {}
    return [];
  };

  const syncWithServer = async () => {
    try {
      const active = await fetchActiveSessions();
      console.log('🔄 同步服务端状态 - 活跃会话数量:', active.length);
      console.log('🔄 活跃会话详情:', active);
      
      setSessions(prev => {
        const next = { ...prev };
        console.log('🔄 当前本地会话状态:', next);
        
        // 重置活动标志（不清除输入值），确保timestamps属性存在
        Object.keys(next).forEach(k => { 
          next[k].isActive = false; 
          next[k].isExperimentActive = false;
          // 确保timestamps属性存在
          if (!next[k].timestamps) {
            next[k].timestamps = { userStart: null, experimentStart: null, experimentEnd: null, userEnd: null };
          }
        });
        
        active.forEach(s => {
          console.log('📋 检查会话 - 数据源:', s.source, '用户名:', s.userName, '会话标识:', s.sessionKey);
          if (next[s.source]) {
            console.log('✅ 匹配到活跃会话:', s.source, s.userName);
            next[s.source].isActive = true;
            next[s.source].isExperimentActive = Array.isArray(s.experiments) && s.experiments.length > 0;
            
            // 恢复用户名和实验名（如果本地没有的话）
            if (s.userName && !next[s.source].userName) {
              next[s.source].userName = s.userName;
            }
            if (s.experiments && s.experiments.length > 0 && s.experiments[s.experiments.length - 1]?.experimentName) {
              next[s.source].experimentName = s.experiments[s.experiments.length - 1].experimentName;
            }
          } else {
            console.log('❌ 会话不匹配 - 数据源不存在:', s.source);
          }
        });
        
        // 智能同步：如果本地状态显示活跃，但服务器没有对应会话，则保留本地状态
        // 这避免了刚设置的状态被错误地重置
        Object.keys(next).forEach(source => {
          if (next[source].isActive && !active.find(s => s.source === source)) {
            console.log(`⚠️ 保留本地活跃状态 - ${source} 在服务器端未找到，但本地显示活跃`);
            // 不重置本地状态，保持 isActive: true
          }
        });
        
        console.log('🔄 同步后的状态:', next);
        return next;
      });
    } catch (e) { 
      console.error('❌ 同步失败:', e); 
    }
  };

  const handleInput = (src, field, val) => {
    setSessions(prev => ({ ...prev, [src]: { ...prev[src], [field]: val } }));
    if (errors[src]) setErrors(prev => ({ ...prev, [src]: '' }));
  };

  const requireField = (src, field, tip) => {
    const v = sessions[src][field];
    if (!v || !String(v).trim()) { setErrors(prev => ({ ...prev, [src]: tip })); return false; }
    return true;
  };

  // 用户开始/结束（前端不提交IP，由服务端自动识别）
  const startUserSession = async (src) => {
    console.log('🔥 点击开始按钮 - 数据源:', src);
    console.log('🔥 当前sessions状态:', sessions);
    console.log('🔥 用户名:', sessions[src]?.userName);
    
    if (!requireField(src, 'userName', '请输入用户名')) {
      console.log('❌ 用户名验证失败');
      return;
    }
    
    console.log('✅ 用户名验证通过，开始记录时间戳...');
    setLoading(true); setErrors(prev => ({ ...prev, [src]: '' })); setMsg('');
    try {
      let ok;
      if (src === 'mobile_web') {
        ok = await recordMobileTimestamp('userStart');
      } else {
        ok = await recordHardwareTimestamp('userStart');
      }
      console.log('🔥 用户开始时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, [src]: { ...prev[src], isActive: true } }));
        console.log('✅ 用户开始时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 用户开始时间戳记录失败');
        setErrors(prev => ({ ...prev, [src]: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, [src]: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const endUserSession = async (src) => {
    setLoading(true); setErrors(prev => ({ ...prev, [src]: '' })); setMsg('');
    try {
      console.log('🛑 结束用户会话 - 数据源:', src);
      let ok;
      if (src === 'mobile_web') {
        ok = await recordMobileTimestamp('userEnd');
      } else {
        ok = await recordHardwareTimestamp('userEnd');
      }
      console.log('🔥 用户结束时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({
          ...prev,
          [src]: { userName: '', experimentName: '', isActive: false, isExperimentActive: false }
        }));
        console.log('✅ 用户结束时间戳记录成功，本地状态已重置');
      } else {
        console.log('❌ 用户结束时间戳记录失败');
        setErrors(prev => ({ ...prev, [src]: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, [src]: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  // 实验开始/结束
  const startExperiment = async (src) => {
    if (!sessions[src].isActive) { setErrors(prev => ({ ...prev, [src]: '请先开始用户会话' })); return; }
    if (!requireField(src, 'experimentName', '请输入实验名称')) return;
    setLoading(true); setErrors(prev => ({ ...prev, [src]: '' })); setMsg('');
    try {
      console.log('🧪 开始实验 - 数据源:', src, '实验名称:', sessions[src].experimentName.trim());
      let ok;
      if (src === 'mobile_web') {
        ok = await recordMobileTimestamp('experimentStart');
      } else {
        ok = await recordHardwareTimestamp('experimentStart');
      }
      console.log('🔥 实验开始时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, [src]: { ...prev[src], isExperimentActive: true } }));
        console.log('✅ 实验开始时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 实验开始时间戳记录失败');
        setErrors(prev => ({ ...prev, [src]: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, [src]: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const endExperiment = async (src) => {
    setLoading(true); setErrors(prev => ({ ...prev, [src]: '' })); setMsg('');
    try {
      console.log('🛑 结束实验 - 数据源:', src);
      let ok;
      if (src === 'mobile_web') {
        ok = await recordMobileTimestamp('experimentEnd');
      } else {
        ok = await recordHardwareTimestamp('experimentEnd');
      }
      console.log('🔥 实验结束时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, [src]: { ...prev[src], isExperimentActive: false, experimentName: '' } }));
        console.log('✅ 实验结束时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 实验结束时间戳记录失败');
        setErrors(prev => ({ ...prev, [src]: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, [src]: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const forceEndExperiment = async (src) => {
    if (!window.confirm('确定要强制结束当前实验吗？')) return;
    setLoading(true); setErrors(prev => ({ ...prev, [src]: '' })); setMsg('');
    try {
      const r = await post(`${config.apiBaseUrl}/api/slide-data/experiment/force-end`, { source: src });
      if (r.success) {
        setSessions(prev => ({ ...prev, [src]: { ...prev[src], isExperimentActive: false, experimentName: '' } }));
        await syncWithServer();
      } else { setErrors(prev => ({ ...prev, [src]: r.error || '强制结束失败' })); }
    } catch (e) { setErrors(prev => ({ ...prev, [src]: '网络错误，请重试' })); }
    setLoading(false);
  };

  // 硬件时间戳与自动处理（IP 服务端自动识别）
  const beijingISO = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}+08:00`;
  };

  const recordHardwareTimestamp = async (type) => {
    try {
      const userName = sessions.hardware_sensor.userName.trim();
      const experimentName = sessions.hardware_sensor.experimentName.trim();
      console.log('🔥 记录硬件时间戳 - 类型:', type, '时间戳:', beijingISO(), '用户名:', userName, '实验名:', experimentName);
      
      const requestData = { 
        timestampType: type, 
        timestamp: beijingISO(),
        userName: userName || null,
        experimentName: experimentName || null
      };
      
      const r = await post(`${config.apiBaseUrl}/api/slide-data/hardware/timestamp`, requestData);
      console.log('🔥 硬件时间戳API响应:', r);
      
      if (r.success) {
        setSessions(prev => ({
          ...prev,
          hardware_sensor: {
            ...prev.hardware_sensor,
            timestamps: { 
              ...(prev.hardware_sensor.timestamps || { userStart: null, experimentStart: null, experimentEnd: null, userEnd: null }), 
              [type]: r.timestamp 
            }
          }
        }));
        console.log('✅ 硬件时间戳记录成功');
        return true;
      } else {
        console.log('❌ 硬件时间戳记录失败:', r.error);
      }
    } catch (e) {
      console.error('❌ 硬件时间戳记录异常:', e);
    }
    return false;
  };

  const recordMobileTimestamp = async (type) => {
    try {
      const userName = sessions.mobile_web.userName.trim();
      const experimentName = sessions.mobile_web.experimentName.trim();
      console.log('📱 记录手机时间戳 - 类型:', type, '时间戳:', beijingISO(), '用户名:', userName, '实验名:', experimentName);
      
      const requestData = { 
        timestampType: type, 
        timestamp: beijingISO(),
        userName: userName || null,
        experimentName: experimentName || null
      };
      
      const r = await post(`${config.apiBaseUrl}/api/slide-data/mobile/timestamp`, requestData);
      console.log('📱 手机时间戳API响应:', r);
      
      if (r.success) {
        setSessions(prev => ({
          ...prev,
          mobile_web: {
            ...prev.mobile_web,
            timestamps: { 
              ...(prev.mobile_web.timestamps || { userStart: null, experimentStart: null, experimentEnd: null, userEnd: null }), 
              [type]: r.timestamp 
            }
          }
        }));
        console.log('✅ 手机时间戳记录成功');
        return true;
      } else {
        console.log('❌ 手机时间戳记录失败:', r.error);
      }
    } catch (e) {
      console.error('❌ 手机时间戳记录异常:', e);
    }
    return false;
  };

  const processHardwareData = async () => {
    try {
      console.log('🔄 开始自动处理硬件数据...');
      const r = await post(`${config.apiBaseUrl}/api/slide-data/hardware/process`, {});
      console.log('🔄 自动处理响应:', r);
      
      if (r.success) { 
        const message = `硬件数据已自动分类到实验目录\n复制了 ${r.processedData?.copied || 0} 条记录\n处理了 ${r.processedData?.experiments || 0} 个实验`;
        console.log('✅ 自动处理成功:', message);
        alert(message);
      } else { 
        const errorMsg = `硬件数据自动处理失败\n错误: ${r.error || '未知错误'}`;
        console.error('❌ 自动处理失败:', errorMsg);
        alert(errorMsg);
      }
    } catch (e) { 
      const errorMsg = `硬件数据自动处理失败\n网络错误: ${e.message || '请检查网络连接'}`;
      console.error('❌ 自动处理异常:', errorMsg);
      alert(errorMsg);
    }
  };

  const processMobileData = async () => {
    try {
      console.log('🔄 开始自动处理手机数据...');
      const r = await post(`${config.apiBaseUrl}/api/slide-data/mobile/process`, {});
      console.log('🔄 自动处理响应:', r);
      
      if (r.success) { 
        const message = r.processedData?.message || `手机数据已自动分类到实验目录\n复制了 ${r.processedData?.copied || 0} 条记录\n处理了 ${r.processedData?.experiments || 0} 个实验`;
        console.log('✅ 自动处理成功:', message);
        alert(message);
      } else { 
        const errorMsg = `手机数据自动处理失败\n错误: ${r.error || '未知错误'}`;
        console.error('❌ 自动处理失败:', errorMsg);
        alert(errorMsg);
      }
    } catch (e) { 
      const errorMsg = `手机数据自动处理失败\n网络错误: ${e.message || '请检查网络连接'}`;
      console.error('❌ 自动处理异常:', errorMsg);
      alert(errorMsg);
    }
  };

  const startHardwareUser = async () => {
    console.log('🔥 开始硬件用户会话');
    console.log('🔥 当前硬件会话状态:', sessions.hardware_sensor);
    
    if (!requireField('hardware_sensor', 'userName', '请输入用户名')) {
      console.log('❌ 硬件用户名验证失败');
      return;
    }
    
    console.log('✅ 硬件用户名验证通过，开始记录时间戳...');
    setLoading(true); setErrors(prev => ({ ...prev, hardware_sensor: '' })); setMsg('');
    try {
      const ok = await recordHardwareTimestamp('userStart');
      console.log('🔥 用户开始时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, hardware_sensor: { ...prev.hardware_sensor, isActive: true } }));
        console.log('✅ 用户开始时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 用户开始时间戳记录失败');
        setErrors(prev => ({ ...prev, hardware_sensor: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, hardware_sensor: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const startHardwareExperiment = async () => {
    if (!sessions.hardware_sensor.isActive) { setErrors(prev => ({ ...prev, hardware_sensor: '请先开始用户会话' })); return; }
    if (!requireField('hardware_sensor', 'experimentName', '请输入实验名称')) return;
    
    setLoading(true); setErrors(prev => ({ ...prev, hardware_sensor: '' })); setMsg('');
    try {
      console.log('🧪 开始硬件实验 - 实验名称:', sessions.hardware_sensor.experimentName.trim());
      const ok = await recordHardwareTimestamp('experimentStart');
      console.log('🔥 实验开始时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, hardware_sensor: { ...prev.hardware_sensor, isExperimentActive: true } }));
        console.log('✅ 实验开始时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 实验开始时间戳记录失败');
        setErrors(prev => ({ ...prev, hardware_sensor: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, hardware_sensor: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const endHardwareExperiment = async () => {
    setLoading(true); setErrors(prev => ({ ...prev, hardware_sensor: '' })); setMsg('');
    try {
      console.log('🛑 结束硬件实验');
      const ok = await recordHardwareTimestamp('experimentEnd');
      console.log('🔥 实验结束时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({ ...prev, hardware_sensor: { ...prev.hardware_sensor, isExperimentActive: false, experimentName: '' } }));
        console.log('✅ 实验结束时间戳记录成功，本地状态已更新');
      } else {
        console.log('❌ 实验结束时间戳记录失败');
        setErrors(prev => ({ ...prev, hardware_sensor: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, hardware_sensor: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  const endHardwareUser = async () => {
    setLoading(true); setErrors(prev => ({ ...prev, hardware_sensor: '' })); setMsg('');
    try {
      console.log('🛑 结束硬件用户会话');
      const ok = await recordHardwareTimestamp('userEnd');
      console.log('🔥 用户结束时间戳记录结果:', ok);
      
      if (ok) {
        setSessions(prev => ({
          ...prev,
          hardware_sensor: { userName: '', experimentName: '', isActive: false, isExperimentActive: false }
        }));
        console.log('✅ 用户结束时间戳记录成功，本地状态已重置');
      } else {
        console.log('❌ 用户结束时间戳记录失败');
        setErrors(prev => ({ ...prev, hardware_sensor: '时间戳记录失败' })); 
      }
    } catch (e) { 
      console.error('❌ 网络错误:', e);
      setErrors(prev => ({ ...prev, hardware_sensor: '网络错误，请重试' })); 
    }
    setLoading(false);
  };

  // 添加渲染时的调试信息
  console.log('🔄 SlideDataManager 渲染 - 当前状态:', {
    loading,
    sessions: {
      mobile_web: { isActive: sessions.mobile_web?.isActive, isExperimentActive: sessions.mobile_web?.isExperimentActive, userName: sessions.mobile_web?.userName, experimentName: sessions.mobile_web?.experimentName },
      desktop_web: { isActive: sessions.desktop_web?.isActive, isExperimentActive: sessions.desktop_web?.isExperimentActive, userName: sessions.desktop_web?.userName, experimentName: sessions.desktop_web?.experimentName },
      hardware_sensor: { isActive: sessions.hardware_sensor?.isActive, isExperimentActive: sessions.hardware_sensor?.isExperimentActive, userName: sessions.hardware_sensor?.userName, experimentName: sessions.hardware_sensor?.experimentName }
    },
    errors,
    msg
  });

  return (
    <Container>
      <Header>
        <BackBtn onClick={() => navigate('/')}> <FiArrowLeft /> 返回聊天</BackBtn>
        <div style={{ display: 'flex', gap: '8px' }}>
          <BackBtn onClick={() => navigate('/session-monitor')} style={{ background: '#17a2b8' }}>
            <FiActivity /> 会话监控
          </BackBtn>
        </div>
      </Header>

      <Section>
        <Title>基础信息</Title>
        <Row>
          <label>数据源：</label>
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="hardware_sensor">hardware_sensor</option>
            <option value="mobile_web">mobile_web</option>
            <option value="desktop_web">desktop_web</option>
          </select>
        </Row>
      </Section>

      {['mobile_web','desktop_web','hardware_sensor'].map((src) => (
        <Section key={src}>
          <Title>{src === 'mobile_web' ? '手机网页' : src === 'desktop_web' ? '电脑网页' : '电脑硬件传感器'}</Title>
          <Row>
            <Input placeholder="用户名" value={sessions[src].userName} onChange={e => handleInput(src, 'userName', e.target.value)} disabled={sessions[src].isActive} />
            {!sessions[src].isActive ? (
              <Button onClick={() => {
                console.log('🔥 按钮被点击了！数据源:', src);
                console.log('🔥 按钮disabled状态:', loading || !sessions[src].userName.trim());
                if (src === 'hardware_sensor') {
                  startHardwareUser();
                } else {
                  startUserSession(src);
                }
              }} disabled={(() => {
                const isDisabled = loading || !sessions[src].userName.trim();
                console.log(`🔥 ${src} 按钮状态检查:`, {
                  loading,
                  userName: sessions[src].userName,
                  userNameTrimmed: sessions[src].userName?.trim(),
                  isDisabled
                });
                return isDisabled;
              })()}>
                <FiPlay /> 开始
              </Button>
            ) : (
              <DangerButton onClick={() => src === 'hardware_sensor' ? endHardwareUser() : endUserSession(src)} disabled={loading}>
                <FiSquare /> 结束
              </DangerButton>
            )}
          </Row>

          <Row>
            <Input placeholder="实验名称" value={sessions[src].experimentName} onChange={e => handleInput(src, 'experimentName', e.target.value)} disabled={!sessions[src].isActive || sessions[src].isExperimentActive} />
            {!sessions[src].isExperimentActive ? (
              <Button onClick={() => src === 'hardware_sensor' ? startHardwareExperiment() : startExperiment(src)} disabled={(() => {
                const isDisabled = loading || !sessions[src].isActive || !sessions[src].experimentName.trim();
                console.log(`🧪 ${src} 实验按钮状态检查:`, {
                  loading,
                  isActive: sessions[src].isActive,
                  experimentName: sessions[src].experimentName,
                  experimentNameTrimmed: sessions[src].experimentName?.trim(),
                  isDisabled
                });
                return isDisabled;
              })()}>
                <FiPlay /> 开始实验
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <DangerButton onClick={() => src === 'hardware_sensor' ? endHardwareExperiment() : endExperiment(src)} disabled={loading}>
                  <FiSquare /> 结束实验
                </DangerButton>
                <WarnButton onClick={() => forceEndExperiment(src)} disabled={loading}>
                  <FiX /> 强制结束
                </WarnButton>
              </div>
            )}
          </Row>

          {src === 'hardware_sensor' && (
            <>
              <Row>
                <Button onClick={() => recordHardwareTimestamp('userStart')}>记录用户开始</Button>
                <Button onClick={() => recordHardwareTimestamp('experimentStart')}>记录实验开始</Button>
                <Button onClick={() => recordHardwareTimestamp('experimentEnd')}>记录实验结束</Button>
                <Button onClick={() => recordHardwareTimestamp('userEnd')}>记录用户结束</Button>
              </Row>
              <Row>
                <Button onClick={processHardwareData}>自动处理硬件数据</Button>
              </Row>
              <Status>
                ⏰ 时间记录：
                用户开始：{sessions.hardware_sensor.timestamps?.userStart ? new Date(sessions.hardware_sensor.timestamps.userStart).toLocaleTimeString() : '—'} | 
                实验开始：{sessions.hardware_sensor.timestamps?.experimentStart ? new Date(sessions.hardware_sensor.timestamps.experimentStart).toLocaleTimeString() : '—'} | 
                实验结束：{sessions.hardware_sensor.timestamps?.experimentEnd ? new Date(sessions.hardware_sensor.timestamps.experimentEnd).toLocaleTimeString() : '—'} | 
                用户结束：{sessions.hardware_sensor.timestamps?.userEnd ? new Date(sessions.hardware_sensor.timestamps.userEnd).toLocaleTimeString() : '—'}
              </Status>
            </>
          )}

          {src === 'mobile_web' && (
            <>
              <Row>
                <Button onClick={() => recordMobileTimestamp('userStart')}>记录用户开始</Button>
                <Button onClick={() => recordMobileTimestamp('experimentStart')}>记录实验开始</Button>
                <Button onClick={() => recordMobileTimestamp('experimentEnd')}>记录实验结束</Button>
                <Button onClick={() => recordMobileTimestamp('userEnd')}>记录用户结束</Button>
              </Row>
              <Row>
                <Button onClick={processMobileData}>自动处理手机数据</Button>
              </Row>
              <Status>
                ⏰ 时间记录：
                用户开始：{sessions.mobile_web.timestamps?.userStart ? new Date(sessions.mobile_web.timestamps.userStart).toLocaleTimeString() : '—'} | 
                实验开始：{sessions.mobile_web.timestamps?.experimentStart ? new Date(sessions.mobile_web.timestamps.experimentStart).toLocaleTimeString() : '—'} | 
                实验结束：{sessions.mobile_web.timestamps?.experimentEnd ? new Date(sessions.mobile_web.timestamps.experimentEnd).toLocaleTimeString() : '—'} | 
                用户结束：{sessions.mobile_web.timestamps?.userEnd ? new Date(sessions.mobile_web.timestamps.userEnd).toLocaleTimeString() : '—'}
              </Status>
            </>
          )}

          {errors[src] && <Note style={{ color: '#dc3545' }}>{errors[src]}</Note>}
          {msg && <Note>{msg}</Note>}
          <Status>
            状态：{sessions[src].isActive ? '会话进行中' : '未开始'}{sessions[src].isExperimentActive ? ' | 实验进行中' : ''}
          </Status>
        </Section>
      ))}
    </Container>
  );
};

export default SlideDataManager;