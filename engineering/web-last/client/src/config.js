// 配置文件 - 统一管理API地址
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const serverPort = 5000;
const serverOrigin = `http://${host}:${serverPort}`;

const config = {
  // 自动使用当前访问主机的IP作为后端地址（端口固定为5000）
  apiBaseUrl: serverOrigin,
  socketUrl: serverOrigin
};

export default config; 