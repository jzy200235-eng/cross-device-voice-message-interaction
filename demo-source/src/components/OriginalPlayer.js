import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FiSend, FiMic, FiPaperclip, FiPlay, FiPause, FiFileText, FiClock, FiUser } from 'react-icons/fi';


import config from '../config'; // 导入配置文件

// 震动音量（0.0 - 1.0）
const VIBRATION_VOLUME = 1.0
const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: white;
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const UserInfo = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-weight: 500;
  color: #333;
`;

const UserStatus = styled.div`
  font-size: 12px;
  color: #666;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    padding: 15px 10px; /* 减少左右边距，让消息更宽 */
    gap: 8px;
  }
`;

const Message = styled.div`
  display: flex;
  justify-content: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
  margin-bottom: 10px;
`;

const MessageContent = styled.div`
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  background: ${props => props.isOwn ? '#0084ff' : 'white'};
  color: ${props => props.isOwn ? 'white' : '#333'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
  
  /* 手机端优化 - 音频消息占满宽度 */
  @media (max-width: 768px) {
    max-width: 95%; /* 手机端音频消息占满大部分宽度 */
    padding: 10px 12px;
    border-radius: 16px;
  }
`;

// 新的音频播放器样式
const AudioPlayerContainer = styled.div`
  background: ${props => props.isOwn ? '#007AFF' : '#F0F0F0'};
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  max-width: 100%; /* 手机端占满宽度 */
  width: 100%; /* 强制占满宽度 */
  color: ${props => props.isOwn ? 'white' : '#333'};
  
  /* 手机端特殊优化 */
  @media (max-width: 768px) {
    padding: 12px;
    margin: 6px 0;
    border-radius: 8px;
  }
`;

const AudioHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-bottom: 10px;
  }
`;

const AudioInfo = styled.div`
  flex: 1;
`;

const AudioTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const AudioDuration = styled.div`
  font-size: 12px;
  opacity: 0.8;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const PlayButton = styled.button`
  background: ${props => props.isOwn ? 'rgba(255,255,255,0.2)' : '#007AFF'};
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${props => props.isOwn ? 'white' : 'white'};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.isOwn ? 'rgba(255,255,255,0.3)' : '#0056CC'};
  }
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
  }
`;

const ProgressContainer = styled.div`
  margin-bottom: 16px;
  cursor: pointer;
  position: relative; /* 便于右侧时长与气泡定位 */
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-bottom: 14px;
  }
`;

const ProgressBar = styled.div`
  position: relative;
  height: 30px;
  background: ${props => props.isOwn ? 'rgba(255,255,255,0.3)' : '#E0E0E0'};
  border-radius: 999px; /* 圆角胶囊 */
  margin-bottom: 8px;
  overflow: visible; /* 让气泡能显示出来 */
  cursor: pointer;
  width: 100%;
`;

const TicksOverlay = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 999px;
  pointer-events: none;
  /* 两层渐变：细小刻度 + 粗刻度 */
  background:
    repeating-linear-gradient(
      to right,
      rgba(122, 99, 255, 0.35) 0px,
      rgba(122, 99, 255, 0.35) 1px,
      transparent 1px,
      transparent 6px
    ),
    repeating-linear-gradient(
      to right,
      rgba(122, 99, 255, 0.6) 0px,
      rgba(122, 99, 255, 0.6) 2px,
      transparent 2px,
      transparent 30px
    );
`;

const SegmentBubble = styled.div`
  position: absolute;
  top: -28px;
  transform: translateX(-50%);
  background: #fff;
  color: #7A63FF;
  border-radius: 12px;
  padding: 2px 6px;
  font-weight: 700;
  font-size: 11px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  user-select: none;
  pointer-events: none;
  &:after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -5px;
    transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #fff;
  }
`;

const DurationInline = styled.div`
  position: absolute;
  right: -42px; /* 稍微伸出一些，像示例里的 60s */
  top: -2px;
  font-size: 12px;
  font-weight: 600;
  color: #7A63FF;
  user-select: none;
`;

const ProgressFill = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${props => props.progress}%;
  background: ${props => props.isOwn ? 'rgba(255,255,255,0.8)' : '#007AFF'};
  border-radius: 4px;
  transition: width 0.1s ease;
`;

const SegmentMarker = styled.div`
  position: absolute;
  top: -4px; /* 调整位置使圆点居中 */
  left: ${props => props.position}%;
  width: 16px; /* 增大圆点尺寸 */
  height: 16px;
  background: ${props => props.isActive ? '#FF6B6B' : '#FFD93D'};
  border-radius: 50%;
  border: 3px solid white; /* 增加白色边框 */
  transform: translateX(-50%);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10; /* 确保圆点在最上层 */

  &:hover {
    transform: translateX(-50%) scale(1.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    width: 14px;
    height: 14px;
    border: 2px solid white;
  }
`;

const ProgressTime = styled.div`
  font-size: 12px;
  text-align: center;
  opacity: 0.8;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const ContentContainer = styled.div`
  margin-bottom: 16px;
  width: 100%; /* 确保内容容器占满宽度 */
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-bottom: 14px;
  }
`;

const ContentPart = styled.div`
  margin-bottom: 12px;
  padding: 12px;
  background: ${props => props.isOwn ? 'rgba(255,255,255,0.1)' : 'white'};
  border-radius: 8px;
  border-left: 4px solid ${props => props.isOwn ? 'rgba(255,255,255,0.5)' : '#007AFF'};
  width: 100%; /* 确保每个部分占满宽度 */
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 6px;
    border-left-width: 3px;
  }
`;

const PartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-bottom: 6px;
  }
`;

const PartTitle = styled.div`
  font-weight: 600;
  font-size: 13px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 12px;
  }
`;

const PartTime = styled.div`
  font-size: 11px;
  opacity: 0.7;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 10px;
  }
`;

const PartContent = styled.div`
  font-size: 12px;
  line-height: 1.4;
  width: 100%; /* 确保内容占满宽度 */
  word-wrap: break-word; /* 允许长单词换行 */
  white-space: pre-wrap; /* 保留换行符和空格 */
  max-height: none; /* 不限制高度，允许内容自然展开 */
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
    line-height: 1.3;
  }
`;

const SenderInfo = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const SummaryText = styled.div`
  margin-bottom: 8px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
    line-height: 1.3;
  }
`;

const SegmentSummary = styled.div`
  font-weight: 500;
  margin-bottom: 6px;
  color: ${props => props.isOwn ? 'rgba(255,255,255,0.9)' : '#007AFF'};
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const OriginalText = styled.div`
  opacity: 0.8;
  font-size: 11px;
  line-height: 1.3;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 10px;
    line-height: 1.2;
  }
`;

const SegmentControls = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  width: 100%; /* 确保控制按钮占满宽度 */
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    gap: 6px;
  }
`;

const SegmentButton = styled.button`
  background: ${props => props.isActive ? '#007AFF' : 'rgba(255,255,255,0.8)'};
  border: 2px solid ${props => props.isActive ? '#007AFF' : '#E0E0E0'};
  border-radius: 50%;
  width: 36px; /* 增大按钮尺寸 */
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${props => props.isActive ? 'white' : '#666'};
  font-weight: 600;
  font-size: 14px; /* 增大字体 */
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background: ${props => props.isActive ? '#0056CC' : '#F0F0F0'};
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }
`;

// 滑动模式选择器样式
const SlideModeSelector = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: ${props => props.isOwn ? 'rgba(255,255,255,0.1)' : '#f8f9fa'};
  border-radius: 8px;
  border: 1px solid ${props => props.isOwn ? 'rgba(255,255,255,0.2)' : '#e0e0e0'};
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    margin-top: 12px;
    padding: 10px;
  }
`;

const SlideModeLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.isOwn ? 'rgba(255,255,255,0.9)' : '#666'};
  margin-bottom: 8px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 11px;
    margin-bottom: 6px;
  }
`;

const SlideModeOptions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    gap: 6px;
  }
`;

const SlideModeButton = styled.button`
  background: ${props => props.isActive ? '#007AFF' : 'rgba(255,255,255,0.8)'};
  border: 1px solid ${props => props.isActive ? '#007AFF' : '#E0E0E0'};
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  color: ${props => props.isActive ? 'white' : '#666'};
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: ${props => props.isActive ? '#0056CC' : '#F0F0F0'};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    padding: 5px 10px;
    font-size: 10px;
  }
`;

// 滑动模式提示样式
const SlideModeHint = styled.div`
  font-size: 10px;
  color: ${props => props.isOwn ? 'rgba(255,255,255,0.7)' : '#999'};
  text-align: center;
  margin-bottom: 6px;
  line-height: 1.3;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 9px;
    margin-bottom: 4px;
  }
`;

// 等分标签容器样式
const EqualDivisionLabels = styled.div`
  position: relative;
  height: 20px;
  margin-top: 4px;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    height: 18px;
    margin-top: 3px;
  }
`;

// 等分标签样式
const DivisionLabel = styled.div`
  position: absolute;
  left: ${props => props.position}%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  
  /* 手机端优化 */
  @media (max-width: 768px) {
    font-size: 9px;
  }
`;

// 添加缺失的样式组件
const SummaryContainer = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  background: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.2)' : '#f8f9fa'};
  border-radius: 12px;
  border-left: 3px solid ${props => props.isOwn ? 'rgba(255, 255, 255, 0.5)' : '#007bff'};
`;

const SummaryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.9)' : '#666'};
  margin-bottom: 4px;
`;

const TranscriptText = styled.div`
  font-size: 12px;
  color: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.8)' : '#666'};
  margin-top: 4px;
  font-style: italic;
`;

const HighlightsContainer = styled.div`
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid ${props => props.isOwn ? 'rgba(255, 255, 255, 0.2)' : '#e0e0e0'};
`;

const Waveform = styled.div`
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
`;

const WaveformBar = styled.div`
  flex: 1;
  height: ${props => props.height}px;
  background: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.3)' : '#007bff'};
  margin: 0 1px;
  border-radius: 1px;
  transition: height 0.2s;
`;

const SegmentMarkers = styled.div`
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
`;

const HighlightItem = styled.div`
  font-size: 11px;
  color: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.8)' : '#666'};
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const VoiceMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
`;

const VoiceButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const VoiceDuration = styled.span`
  font-size: 12px;
  opacity: 0.8;
`;

const AudioMetadata = styled.div`
  margin-top: 6px;
  padding: 6px 8px;
  background: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0'};
  border-radius: 8px;
  font-size: 11px;
  color: ${props => props.isOwn ? 'rgba(255, 255, 255, 0.8)' : '#666'};
`;

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FileMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const FileIcon = styled.div`
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

const FileInfo = styled.div`
  flex: 1;
`;

const FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
`;

const FileSize = styled.div`
  font-size: 12px;
  opacity: 0.8;
`;

const InputContainer = styled.div`
  background: white;
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
`;

const TextArea = styled.textarea`
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  padding: 10px 15px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #0084ff;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 5px;
`;

const IconButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #f0f0f0;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: #e0e0e0;
    color: #333;
  }
`;

const SendButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: ${props => props.disabled ? '#ccc' : '#0084ff'};
  color: white;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.disabled ? '#ccc' : '#0066cc'};
  }
`;

const FileInput = styled.input`
  display: none;
`;

// 上传进度组件
const UploadProgressContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 300px;
  text-align: center;
`;

const UploadProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin: 10px 0;
`;

const UploadProgressFill = styled.div`
  height: 100%;
  background: #007AFF;
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const UploadText = styled.div`
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
`;

const UploadCancelButton = styled.button`
  background: #ff3b30;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
  margin-top: 10px;
  
  &:hover {
    background: #d70015;
  }
`;

// 音频选择器样式
const AudioSelectorContainer = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-top: 8px;
  max-height: 300px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const AudioSelectorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  font-weight: 500;
  font-size: 14px;
`;

const AudioSelectorList = styled.div`
  max-height: 250px;
  overflow-y: auto;
`;

const AudioSelectorItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const AudioSelectorInfo = styled.div`
  flex: 1;
`;

const AudioSelectorTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
`;

const AudioSelectorSummary = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
  line-height: 1.3;
`;

const AudioSelectorDuration = styled.div`
  font-size: 11px;
  color: #999;
`;

const AudioSelectorButton = styled.button`
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #0056CC;
  }
`;

// 新的音频播放器组件
const AudioPlayer = ({ message, isOwn, onPlay, onPause, onSeek, isPlaying, currentTime, duration, socket, slideMode, setSlideMode, seekPolicy, setSeekPolicy, onFocusMessage, hardwareProgressPct, showStudyControls = false }) => {
  const [progress, setProgress] = useState(0);
  const demoPrevPctRef = useRef(null);
  const demoLastCrossedRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [lastCrossedNode, setLastCrossedNode] = useState(null); // 记录上次经过的节点
  const progressRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragPrevTimeRef = useRef(null);
  const skipNextClickRef = useRef(false);
  
  // 震动音效与节点播报TTS
  const vibrationAudioRef = useRef(null);
  const nodeTtsRefs = useRef({}); // {summary, p1, p2, p3}
  const announceTimerRef = useRef(null); // 防抖计时器
  const prevHardwarePctRef = useRef(null);
  const announcedPartsRef = useRef(new Set()); // 本次拖动已播报过的结点part集合
  const lastDirectionRef = useRef(null); // 上一次方向（true正向、false反向）
  const prevActiveBubbleRef = useRef(null); // 上一次激活的 1/2/3 气泡编号
  const lastAnnouncedPartRef = useRef(null); // 近实时去重：最近播报的 part
  const lastAnnouncedAtRef = useRef(0); // 最近播报时间戳
  const latestNodeRef = useRef(null); // 硬件事件合并：仅播报最后一个
  const announceSeqRef = useRef(0); // 播报序列号：仅播放最新的一次
  
  // 使用 Web Audio 作为振动音效的后备
  const playWebAudioBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 200; // 200Hz 短促提示
      gain.gain.value = 0.05; // 轻微音量
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 80);
    } catch (_) {}
  };

  const playVibrationSound = () => {
    console.log('[TTS] 尝试播放震动提示');
    if (vibrationAudioRef.current) {
      try {
        vibrationAudioRef.current.currentTime = 0;
        const p = vibrationAudioRef.current.play();
        if (p && typeof p.then === 'function') {
          p.catch((err) => {
            console.warn('震动音效播放失败(文件):', err);
            playWebAudioBeep();
          });
        }
      } catch (err) {
        console.warn('震动音效播放异常:', err);
        playWebAudioBeep();
      }
      return;
    }
    playWebAudioBeep();
  };

  // 停止所有节点播报音频与语音合成，防止堆积
  const stopAllNodeTts = () => {
    try {
      const refs = nodeTtsRefs.current || {};
      Object.keys(refs).forEach((k) => {
        const a = refs[k];
        if (a && typeof a.pause === 'function') {
          try { a.pause(); } catch(_) {}
          try { a.currentTime = 0; } catch(_) {}
        }
      });
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch(_) {}
      }
    } catch(_) {}
  };

  // 在 AudioPlayer 内监听节点播报事件（此处可访问到播放与播报函数）
  useEffect(() => {
    const onAnnounce = (e) => {
      try {
        const { messageId, nodeInfo } = e.detail || {};
        if (!nodeInfo) return;
        if (message && message.id && messageId === message.id) {
          // 合并快速连续事件：只播报最后一个
          latestNodeRef.current = nodeInfo;
          // 递增序列号，旧的计时回调将被丢弃
          announceSeqRef.current = (announceSeqRef.current || 0) + 1;
          const seq = announceSeqRef.current;
          if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
          announceTimerRef.current = setTimeout(() => {
            if (seq !== announceSeqRef.current) return; // 过期回调丢弃
            const finalNode = latestNodeRef.current;
            if (!finalNode) return;
            // 轻量去重（含方向反转清空）：同一 part 在 1000ms 内不重复播报
            const now = Date.now();
            const part = finalNode.part ?? '__unknown__';
            // 若方向发生反转，则清空去重状态，允许再次播报
            const lastDir = (latestNodeRef.current && latestNodeRef.current.direction) || null;
            const currDir = finalNode.direction || null;
            if (lastDir && currDir && lastDir !== currDir) {
              lastAnnouncedPartRef.current = null;
              lastAnnouncedAtRef.current = 0;
            }
            if (lastAnnouncedPartRef.current === part && (now - (lastAnnouncedAtRef.current || 0)) < 1000) {
              return;
            }
            lastAnnouncedPartRef.current = part;
            lastAnnouncedAtRef.current = now;
            // 开播前先清空堆积的音频/合成
            stopAllNodeTts();
            playVibrationSound();
            announceNode(finalNode);
          }, 120);
        }
      } catch(_) {}
    };
    window.addEventListener('announce_node', onAnnounce);
    return () => window.removeEventListener('announce_node', onAnnounce);
  }, [message]);

  // 基于 SegmentMarker 激活变化的硬件播报（1/2/3）
  // 注意：必须放在 audioDuration/partInfo 定义之后，避免 TDZ 错误
  // 该逻辑依赖 currentTime、audioDuration、partInfo 的实时值

  // 拖拽相关：计算并更新进度（鼠标与触摸）
  const getClientX = (e) => (
    (e && 'touches' in e && e.touches && e.touches.length > 0)
      ? e.touches[0].clientX
      : (e && 'changedTouches' in e && e.changedTouches && e.changedTouches.length > 0)
        ? e.changedTouches[0].clientX
        : e.clientX
  );

  const updateByClientX = (clientX) => {
    if (!progressRef.current || !audioDuration || audioDuration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = (x / rect.width) * 100;
    // 展示适配：将原Chat父组件中的硬件松手判定应用于鼠标参照路径。
    const nodes = partInfo.map((p,i) => ({pct: slideMode === 'equal' ? i*25 : p.startTime/audioDuration*100, time:p.startTime}));
    const prev = demoPrevPctRef.current;
    if (prev !== null && pct !== prev) {
      const crossed = nodes.filter(n => pct > prev ? n.pct > prev && n.pct <= pct : n.pct < prev && n.pct >= pct);
      if(crossed.length) demoLastCrossedRef.current = pct > prev ? crossed[crossed.length-1].time : crossed[0].time;
    }
    demoPrevPctRef.current = pct;
    let targetTime;
    if (partInfo.length > 0 && (slideMode === 'equal' || slideMode === 'segmented')) {
      // 区间内直接跳转到结点起始
      if (slideMode === 'equal') {
        const [p1, p2, p3, p4] = [
          partInfo.find(p => p.part === 1),
          partInfo.find(p => p.part === 2),
          partInfo.find(p => p.part === 3),
          partInfo.find(p => p.part === 4),
        ];
        if (pct <= 25) targetTime = p1?.startTime ?? 0;
        else if (pct <= 50) targetTime = p2?.startTime ?? 0;
        else if (pct <= 75) targetTime = p3?.startTime ?? 0;
        else targetTime = p4?.startTime ?? 0;
      } else {
        const tRaw = (pct / 100) * audioDuration;
        const inPart = partInfo.find(p => tRaw >= p.startTime && tRaw <= p.endTime);
        targetTime = inPart ? inPart.startTime : 0;
      }
    } else {
      // 无极模式或无分段数据：按比例
      targetTime = (pct / 100) * audioDuration;
    }
    // 对外广播使用真实时间百分比，保持跨端一致
    sendWebProgressControl((targetTime / audioDuration) * 100);
    onSeek(targetTime);
    return targetTime;
  };

  const handleDragStart = (e) => {
    // 记录当前交互的消息，供硬件滑动对齐
    try { onFocusMessage && onFocusMessage(message.id); } catch (_) {}
    if (!progressRef.current || !audioDuration || audioDuration <= 0) return;
    e.preventDefault?.();
    setIsDragging(true);
    skipNextClickRef.current = true;
    dragPrevTimeRef.current = currentTime;
    
    // 移除拖动开始时的全局暂停逻辑，避免点击被当作暂停
    // 原先通过 socket.emit('pause_long_audio') 的逻辑已删除

    demoPrevPctRef.current = null;
    demoLastCrossedRef.current = null;
    const t0 = updateByClientX(getClientX(e));
    if (typeof t0 === 'number') {
      const crossedNode = checkNodeCrossing(t0, dragPrevTimeRef.current ?? currentTime);
      if (crossedNode) {
        if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
        announceTimerRef.current = setTimeout(() => {
          playVibrationSound();
          announceNode(crossedNode);
        }, 120);
      }
      setLastCrossedNode(t0);
      dragPrevTimeRef.current = t0;
    }

    const move = (ev) => {
      ev.preventDefault?.();
      const t = updateByClientX(getClientX(ev));
      if (typeof t === 'number') {
        const crossedNode = checkNodeCrossing(t, dragPrevTimeRef.current ?? currentTime);
        if (crossedNode) {
          if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
          announceTimerRef.current = setTimeout(() => {
            playVibrationSound();
            announceNode(crossedNode);
          }, 120);
        }
        setLastCrossedNode(t);
        dragPrevTimeRef.current = t;
      }
    };

    const up = () => {
      if (seekPolicy === 'snap' && slideMode !== 'continuous' && typeof demoLastCrossedRef.current === 'number') {
        onSeek(demoLastCrossedRef.current);
      }
      setIsDragging(false);
      
      // 移除拖动结束后的全局恢复逻辑，避免无故停留在暂停态
      // 原先通过 socket.emit('resume_long_audio') 的逻辑已删除
      
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
      dragPrevTimeRef.current = null;
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  };

  // 检测是否经过节点
  const checkNodeCrossing = (currentTime, previousTime) => {
    if (!audioDuration || audioDuration <= 0) return null;
    const currentPercent = currentTime / audioDuration;
    const previousPercent = previousTime / audioDuration;
    if (currentPercent === previousPercent) return null;
    const forward = currentPercent > previousPercent;

    if (slideMode === 'equal') {
      // 等分模式：使用和非等分一样的逻辑，检测实际音频元数据的节点
      // UI上显示等分，但播报逻辑基于真实数据
      if (partInfo.length > 0) {
        // 片段起始百分比列表（不含0-起始）
        const starts = partInfo.map(p => ({ part: p.part, start: p.startTime / audioDuration })).sort((a,b)=>a.start-b.start);
        const low = Math.min(previousPercent, currentPercent);
        const high = Math.max(previousPercent, currentPercent);
        const crossed = starts.filter(s => s.start > low && s.start <= high);
        if (crossed.length === 0) return null;
        const node = forward ? crossed[crossed.length - 1] : crossed[0];
        return {
          type: 'equal',
          position: node.start * 100,
          part: node.part,
          title: (partInfo.find(p => p.part === node.part)?.title)
        };
      }
    } else {
      // 非等分：按实际片段起始
      if (partInfo.length > 0) {
        // 片段起始百分比列表（不含0-起始）
        const starts = partInfo.map(p => ({ part: p.part, start: p.startTime / audioDuration })).sort((a,b)=>a.start-b.start);
        const low = Math.min(previousPercent, currentPercent);
        const high = Math.max(previousPercent, currentPercent);
        const crossed = starts.filter(s => s.start > low && s.start <= high);
        if (crossed.length === 0) return null;
        const node = forward ? crossed[crossed.length - 1] : crossed[0];
        return {
          type: 'actual',
          position: node.start * 100,
          part: node.part,
          title: (partInfo.find(p => p.part === node.part)?.title)
        };
      }
    }
    return null;
  };

  // 基于百分比的节点判定（与上面时间版逻辑等价，但直接用百分比，供硬件路径使用）
  const checkNodeCrossingByPct = (currentPct, previousPct) => {
    if (!audioDuration || audioDuration <= 0) return null;
    if (typeof currentPct !== 'number' || typeof previousPct !== 'number') return null;
    if (currentPct === previousPct) return null;
    const forward = currentPct > previousPct;
    const low = Math.min(previousPct, currentPct) / 100;
    const high = Math.max(previousPct, currentPct) / 100;

    if (slideMode === 'equal') {
      // 等分模式：使用和非等分一样的逻辑，检测实际音频元数据的节点
      // UI上显示等分，但播报逻辑基于真实数据
      if (partInfo.length > 0) {
        const starts = partInfo
          .map(p => ({ part: p.part, start: p.startTime / audioDuration }))
          .sort((a, b) => a.start - b.start);
        const crossed = starts.filter(s => s.start > low && s.start <= high);
        if (crossed.length === 0) return null;
        const node = forward ? crossed[crossed.length - 1] : crossed[0];
        return {
          type: 'equal',
          position: node.start * 100,
          part: node.part,
          title: (partInfo.find(p => p.part === node.part)?.title)
        };
      }
    } else {
      // 非等分：按实际片段起始的百分比
      if (partInfo.length > 0) {
        const starts = partInfo
          .map(p => ({ part: p.part, start: p.startTime / audioDuration }))
          .sort((a, b) => a.start - b.start);
        const crossed = starts.filter(s => s.start > low && s.start <= high);
        if (crossed.length === 0) return null;
        const node = forward ? crossed[crossed.length - 1] : crossed[0];
        return {
          type: 'actual',
          position: node.start * 100,
          part: node.part,
          title: (partInfo.find(p => p.part === node.part)?.title)
        };
      }
    }
    return null;
  };
  
  // 根据等分位置获取部分信息
  const getPartByEqualPosition = (position) => {
    if (position === 0) return 1;
    if (position === 0.25) return 2;
    if (position === 0.5) return 3;
    if (position === 0.75) return 4;
    return 1;
  };
  
  // 等分模式下：时间与进度百分比的双向映射
  const getPartBounds = () => {
    const p1 = partInfo.find(p => p.part === 1);
    const p2 = partInfo.find(p => p.part === 2);
    const p3 = partInfo.find(p => p.part === 3);
    const p4 = partInfo.find(p => p.part === 4);
    if (!p1 || !p2 || !p3 || !p4) return null;
    return [p1, p2, p3, p4];
  };

  const timeToEqualPercent = (t) => {
    const bounds = getPartBounds();
    if (!bounds || !audioDuration) return (t / (audioDuration || 1)) * 100;
    const [p1, p2, p3, p4] = bounds;
    if (t <= p1.startTime) return 0;
    if (t <= p1.endTime) return 0 + ((t - p1.startTime) / Math.max(1e-6, (p1.endTime - p1.startTime))) * 25;
    if (t <= p2.endTime) return 25 + ((t - p2.startTime) / Math.max(1e-6, (p2.endTime - p2.startTime))) * 25;
    if (t <= p3.endTime) return 50 + ((t - p3.startTime) / Math.max(1e-6, (p3.endTime - p3.startTime))) * 25;
    if (t <= p4.endTime) return 75 + ((t - p4.startTime) / Math.max(1e-6, (p4.endTime - p4.startTime))) * 25;
    return 100;
  };

  // 硬件覆盖进度的节点播报（移动到 audioDuration/partInfo 定义之后，避免TDZ）

  const percentToTimeEqual = (pct) => {
    const bounds = getPartBounds();
    if (!bounds || !audioDuration) return (pct / 100) * (audioDuration || 0);
    const [p1, p2, p3, p4] = bounds;
    if (pct <= 25) {
      const r = (pct - 0) / 25;
      return p1.startTime + r * (p1.endTime - p1.startTime);
    } else if (pct <= 50) {
      const r = (pct - 25) / 25;
      return p2.startTime + r * (p2.endTime - p2.startTime);
    } else if (pct <= 75) {
      const r = (pct - 50) / 25;
      return p3.startTime + r * (p3.endTime - p3.startTime);
    } else {
      const r = (pct - 75) / 25;
      return p4.startTime + r * (p4.endTime - p4.startTime);
    }
  };
  
  // 播报节点信息
  const announceNode = (nodeInfo) => {
    console.log('成功播报1/2/3');
    // 内联播放：优先使用 nodeTtsRefs 音频，失败回退 speechSynthesis
    const playKey = (key, fallbackText) => {
      try {
        const audio = nodeTtsRefs.current?.[key];
        if (audio && audio.src) {
          audio.currentTime = 0;
          const p = audio.play();
          if (p && typeof p.then === 'function') {
            p.catch((err) => {
              console.warn('[TTS] 节点音频播放失败，回退语音合成:', err);
              if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance(fallbackText || '');
                u.lang = 'zh-CN'; u.rate = 0.9; window.speechSynthesis.speak(u);
              }
            });
          }
        } else if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(fallbackText || '');
          u.lang = 'zh-CN'; u.rate = 0.9; window.speechSynthesis.speak(u);
        }
      } catch (e) {
        console.warn('[TTS] 播放TTS异常:', e);
      }
    };

    const nowTs = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const pctNow = audioDuration > 0 ? Math.round((currentTime / audioDuration) * 100) : null;
    if (nodeInfo.type === 'equal') {
      const part = nodeInfo.part;
      console.log(`[TTS] ${nowTs} 等分节点播报 part=${part} pct≈${pctNow}%`);
      if (part === 1) {
        playKey('summary', '总摘要');
      } else if (part === 2) {
        playKey('p1', '一');
      } else if (part === 3) {
        playKey('p2', '二');
      } else if (part === 4) {
        playKey('p3', '三');
      }
      return;
    }

    if (nodeInfo.type === 'actual') {
      const nPart = nodeInfo.part;
      console.log(`[TTS] ${nowTs} 分摘要节点播报 part=${nPart} title=${nodeInfo.title || ''} pct≈${pctNow}%`);
      const idx = (nPart - 1);
      if (idx === 1) {
        playKey('p1', '一');
      } else if (idx === 2) {
        playKey('p2', '二');
      } else if (idx === 3) {
        playKey('p3', '三');
      } else if (idx <= 0) {
        playKey('summary', '总摘要');
      }
      return;
    }
  };
  
  // 发送网页端进度控制
  const sendWebProgressControl = (position) => {
    if (socket) {
      // 检测设备类型
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                      window.innerWidth <= 768 || 
                      'ontouchstart' in window;
      const clientType = isMobile ? 'mobile' : 'desktop';
      
      socket.emit('web_progress_control', {
        position: position,
        timestamp: Date.now(),
        clientType: clientType
      });
      console.log('发送网页端进度控制:', position + '%', '设备类型:', clientType);
    }
  };
  
  // 获取音频时长
  const getAudioDuration = () => {
    if (duration > 0) return duration;
    if (message.audioMetadata?.audio_duration_sec) return message.audioMetadata.audio_duration_sec;
    if (message.summary?.audio_duration_sec) return message.summary.audio_duration_sec;
    
    // 尝试从content中解析
    try {
      const voiceData = JSON.parse(message.content);
      return voiceData.duration || 0;
    } catch (error) {
      return 0;
    }
  };
  
  const audioDuration = getAudioDuration();
  
  useEffect(() => {
    // 使用新的分割信息
    if (message.audioMetadata?.segments) {
      const segmentData = message.audioMetadata.segments.map((segment, index) => ({
        id: index + 1,
        part: segment.part,
        type: segment.type,
        startTime: segment.start_time,
        endTime: segment.end_time,
        duration: segment.duration,
        description: segment.description,
        position: (segment.start_time / audioDuration) * 100
      }));
      setSegments(segmentData);
    } else if (message.summary && message.summary.highlights) {
      // 兼容旧格式
      const totalDuration = audioDuration;
      if (totalDuration > 0) {
        const segmentData = message.summary.highlights.map((highlight, index) => ({
          id: index + 1,
          startTime: highlight.start_time_sec,
          endTime: highlight.end_time_sec,
          duration: highlight.duration_sec,
          summary: highlight.summary_text,
          original: highlight.original_text,
          position: (highlight.start_time_sec / totalDuration) * 100
        }));
        setSegments(segmentData);
      }
    }
  }, [message, audioDuration]);

  useEffect(() => {
    if (audioDuration > 0) {
      const pct = (slideMode === 'equal' && partInfo.length > 0)
        ? timeToEqualPercent(currentTime)
        : (currentTime / audioDuration) * 100;
      setProgress(pct);
      // 更新当前段
      const currentSeg = segments.find(seg => 
        currentTime >= seg.startTime && currentTime <= seg.endTime
      );
      if (currentSeg) {
        setCurrentSegment(currentSeg.id - 1);
      }
      // 拖拽期间不额外播报
    }
  }, [currentTime, audioDuration, segments]);

  const handleProgressClick = (e) => {
    // 记录当前交互的消息
    try { onFocusMessage && onFocusMessage(message.id); } catch (_) {}
    if (skipNextClickRef.current) { skipNextClickRef.current = false; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    let targetTime;
    
    // 根据滑动模式计算目标时间
    switch (slideMode) {
      case 'continuous':
        // 无极滑动：直接跳转到点击位置
        targetTime = (percentage / 100) * audioDuration;
        break;
        
      case 'equal':
        // 等分滑动：落在区间内直接跳到该区间起始
        {
          const [p1, p2, p3, p4] = [
            partInfo.find(p => p.part === 1),
            partInfo.find(p => p.part === 2),
            partInfo.find(p => p.part === 3),
            partInfo.find(p => p.part === 4),
          ];
          if (percentage <= 25) targetTime = p1?.startTime ?? 0;
          else if (percentage <= 50) targetTime = p2?.startTime ?? 0;
          else if (percentage <= 75) targetTime = p3?.startTime ?? 0;
          else targetTime = p4?.startTime ?? 0;
        }
        break;
        
      case 'segmented':
        // 非等分滑动：落在区间内直接跳到该区间起始
        if (partInfo.length > 0) {
          const tRaw = (percentage / 100) * audioDuration;
          const inPart = partInfo.find(p => tRaw >= p.startTime && tRaw <= p.endTime);
          targetTime = inPart ? inPart.startTime : 0;
        } else {
          targetTime = 0;
        }
        break;
        
      default:
        targetTime = (percentage / 100) * audioDuration;
    }
    
    console.log('Progress bar clicked:', { 
      percentage, 
      slideMode, 
      targetTime, 
      audioDuration 
    });
    
    onSeek && onSeek(targetTime); // 展示修复：点击进度条实际跳转
  };

  const handlePartClick = (part) => {
    // 记录当前交互的消息
    try { onFocusMessage && onFocusMessage(message.id); } catch (_) {}
    console.log('Part button clicked:', part);
    
    let targetTime;
    
    // 根据滑动模式决定跳转行为
    switch (slideMode) {
      case 'continuous':
        // 无极滑动：可以跳转到任意位置
        targetTime = part.startTime;
        break;
        
      case 'equal':
      case 'segmented':
        // 等分滑动和非等分滑动：都跳到部分开始
        targetTime = part.startTime;
        break;
        
      default:
        targetTime = part.startTime;
    }
    
    // 计算百分比位置
    const percentage = (targetTime / audioDuration) * 100;
    
    // 发送网页端进度控制信号
    sendWebProgressControl(percentage);
    
    const wasPlaying = isPlaying;
    // 先立即跳转
    onSeek && onSeek(targetTime);
    setLastCrossedNode(targetTime);

    // 120ms 后做节点播报判断
    setTimeout(() => {
      const prevTime = (lastCrossedNode ?? currentTime);
      const crossedNode = checkNodeCrossing(targetTime, prevTime);
      if (crossedNode) {
        if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
        announceTimerRef.current = setTimeout(() => {
          playVibrationSound();
          announceNode(crossedNode);
        }, 0);
      }
    }, 120);

    // 350ms 后如原先在播放则自动继续
    if (wasPlaying && typeof onPlay === 'function') {
      if (window.pendingResumePlaybackTimer) {
        clearTimeout(window.pendingResumePlaybackTimer);
      }
      window.pendingResumePlaybackForMessageId = message.id;
      window.pendingResumePlaybackTimer = setTimeout(() => {
        if (window.pendingResumePlaybackForMessageId === message.id) {
          onPlay();
        }
        window.pendingResumePlaybackTimer = null;
        window.pendingResumePlaybackForMessageId = null;
      }, 350);
    }
  };

  // 防止事件冒泡的包装函数
  const handlePartClickWrapper = (e, part) => {
    e.preventDefault(); // 防止按钮的默认行为
    handlePartClick(part);
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取四个主要部分的信息
  const getPartInfo = () => {
    const parts = [];
    
    // Part 1: 发送人+总摘要
    const part1Segment = segments.find(s => s.part === 1 && s.type === 'summary');
    if (part1Segment) {
      parts.push({
        part: 1,
        title: message.audioMetadata?.sender || message.senderName, // 直接显示发送人
        startTime: part1Segment.startTime,
        endTime: part1Segment.endTime,
        description: part1Segment.description,
        summary: message.audioMetadata?.overall_summary || message.summary?.summary || '暂无摘要' // 添加总摘要内容
      });
    }
    
    // Part 2-4: 分摘要+对应的原语音（只保留3个分摘要）
    for (let i = 2; i <= 4; i++) {
      const summarySegment = segments.find(s => s.part === i && s.type === 'summary_tts');
      const originalSegment = segments.find(s => s.part === i && s.type === 'original_audio');
      
      if (summarySegment && originalSegment) {
        // 修正分摘要编号，确保显示正确的编号
        const correctSummaryNumber = i - 1; // 分摘要1、分摘要2、分摘要3
        
        // 处理summary描述，移除可能包含的错误编号
        let cleanSummary = summarySegment.description;
        // 移除可能存在的"分摘要X："前缀
        cleanSummary = cleanSummary.replace(/^分摘要\d+：?\s*/, '');
        
        // 处理original描述，移除可能包含的错误编号
        let cleanOriginal = originalSegment.description;
        // 移除可能存在的"原语音片段X："前缀
        cleanOriginal = cleanOriginal.replace(/^原语音片段\d+：?\s*/, '');
        
        parts.push({
          part: i,
          title: `分摘要${correctSummaryNumber}`, // 使用正确的编号
          startTime: summarySegment.startTime,
          endTime: originalSegment.endTime,
          summary: cleanSummary, // 使用清理后的摘要
          original: cleanOriginal // 使用清理后的原文
        });
      }
    }
    
    return parts;
  };

  const partInfo = getPartInfo();

  // 硬件覆盖进度变化时，检测跨节点并播报（放在 audioDuration/partInfo 之后）
  useEffect(() => {
    if (typeof hardwareProgressPct !== 'number') return; // 仅打印/处理有效数值
    if (!audioDuration || audioDuration <= 0) return;

    const previousPct = typeof prevHardwarePctRef.current === 'number' ? prevHardwarePctRef.current : hardwareProgressPct;
    const currentPct = hardwareProgressPct;
    if (currentPct === previousPct) return;

    try { console.log('[HW] 覆盖进度变化:', previousPct + '%', '→', currentPct + '%', 'mode:', slideMode, 'messageId:', message?.id); } catch (_) {}

    // 方向仅用于判定跨越方向；不再据此做去重或清空
    const forward = currentPct > previousPct;

    const pctToTime = (pct) => {
      if (slideMode === 'equal') {
        // 等分模式：直接使用百分比，避免时间转换的精度损失
        // 根据百分比区间直接返回对应部分的开始时间
        if (pct <= 25) {
          const p1 = partInfo.find(p => p.part === 1);
          return p1?.startTime ?? 0;
        } else if (pct <= 50) {
          const p2 = partInfo.find(p => p.part === 2);
          return p2?.startTime ?? 0;
        } else if (pct <= 75) {
          const p3 = partInfo.find(p => p.part === 3);
          return p3?.startTime ?? 0;
        } else {
          const p4 = partInfo.find(p => p.part === 4);
          return p4?.startTime ?? 0;
        }
      } else if (slideMode === 'segmented' && partInfo.length > 0) {
        const tRaw = (pct / 100) * (audioDuration || 0);
        const inPart = partInfo.find(p => tRaw >= p.startTime && tRaw <= p.endTime);
        return inPart ? inPart.startTime : 0;
      }
      return (pct / 100) * (audioDuration || 0);
    };

    // 使用百分比版的节点判定，确保与网页端交互一致但避免时间映射差异
    let crossedNode = checkNodeCrossingByPct(currentPct, previousPct);
    if (crossedNode) { try { console.log('[HW] 检测跨节点结果:', crossedNode); } catch(_) {} }

    // continuous 模式：按分摘要节点(1/2/3)的起点检测穿越（更宽松，带容差）
    if (!crossedNode && slideMode === 'continuous' && partInfo.length > 0 && audioDuration > 0) {
      const summaryNodes = partInfo
        .filter(p => p.part >= 2 && p.part <= 4 && typeof p.startTime === 'number')
        .map(p => ({ part: p.part, startPct: p.startTime / audioDuration }));
      const low = Math.min(previousPct, currentPct) / 100;
      const high = Math.max(previousPct, currentPct) / 100;
      const EPS = 0.05; // 5% 容差
      const crossed = summaryNodes.filter(n => (n.startPct + EPS) > low && (n.startPct - EPS) <= high);
      if (crossed.length > 0) {
        const node = forward ? crossed.sort((a,b)=>a.startPct-b.startPct)[crossed.length - 1] : crossed.sort((a,b)=>a.startPct-b.startPct)[0];
        crossedNode = {
          type: 'actual',
          position: node.startPct * 100,
          part: node.part,
          title: (partInfo.find(p => p.part === node.part)?.title)
        };
        // 向服务器输出跨越结点调试信息
        try {
          socket && socket.emit && socket.emit('tts_debug', {
            kind: 'hit', mode: 'continuous', source: 'hardware',
            part: crossedNode.part, positionPct: crossedNode.position,
            messageId: message?.id, timestamp: Date.now()
          });
        } catch (_) {}
      }
    }

    if (crossedNode) {
      if (slideMode === 'continuous') {
        // 无极模式：立即播报，不等待
        playVibrationSound();
        try { console.log('[HW] 立即播报节点(continuous):', crossedNode); } catch(_) {}
        announceNode(crossedNode);
        // 向服务器输出播报事件
        try {
          socket && socket.emit && socket.emit('tts_debug', {
            kind: 'announce', mode: 'continuous', source: 'hardware',
            part: crossedNode.part, positionPct: crossedNode.position,
            messageId: message?.id, timestamp: Date.now()
          });
        } catch (_) {}
      } else {
        // 其他模式保留防抖
        if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
        announceTimerRef.current = setTimeout(() => {
          playVibrationSound();
          try { console.log('[HW] 防抖后播报节点:', crossedNode); } catch(_) {}
          announceNode(crossedNode);
          try {
            socket && socket.emit && socket.emit('tts_debug', {
              kind: 'announce', mode: slideMode, source: 'hardware',
              part: crossedNode.part, positionPct: crossedNode.position,
              messageId: message?.id, timestamp: Date.now()
            });
          } catch (_) {}
        }, 0);
      }
      // 取消加入已播报集合，实现无去重（硬件路径）
    }

    prevHardwarePctRef.current = currentPct;
  }, [hardwareProgressPct, audioDuration, slideMode, partInfo]);

  return (
    <AudioPlayerContainer isOwn={isOwn}>
      <AudioHeader>
        <AudioInfo>
          <AudioTitle>{message.audioMetadata?.sender || message.senderName}</AudioTitle>
          <AudioDuration>{formatTime(audioDuration)}</AudioDuration>
        </AudioInfo>
        <PlayButton aria-label={isPlaying ? "暂停播放" : "播放合成示例"} onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
        </PlayButton>
      </AudioHeader>

      {/* 进度条 */}
      <ProgressContainer onClick={handleProgressClick}>
        {/* 滑动模式提示 */}
        <SlideModeHint isOwn={isOwn}>
          {slideMode === 'continuous' && '无极滑动：可自由滑动到任意位置'}
          {slideMode === 'equal' && (seekPolicy === 'snap' ? '等分＋吸附：松手保留最后经过的节点' : '等分＋区间：松手按当前区间起点定位')}
          {slideMode === 'segmented' && '非等分滑动：根据实际时间区间，滑动到区间跳到对应部分开始'}
        </SlideModeHint>
        
        <div style={{ position: 'relative' }}>
          <ProgressBar
            ref={progressRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
          >
            <ProgressFill 
              progress={typeof hardwareProgressPct === 'number' ? hardwareProgressPct : progress} 
              style={{ transition: typeof hardwareProgressPct === 'number' ? 'none' : undefined }}
            />
            <TicksOverlay />
            {slideMode === 'equal' ? (
              // 等分：显示等分节点 (0%,25%,50%,75%) 与 1/2/3 气泡
              <>
                <SegmentMarker
                  position={0}
                  isActive={currentTime >= 0 && currentTime < (audioDuration * 0.25)}
                  onClick={(e) => { e.stopPropagation(); onSeek(0); }}
                  title="Part 1: 发送人+总摘要"
                />
                <SegmentMarker
                  position={25}
                  isActive={currentTime >= (audioDuration * 0.25) && currentTime < (audioDuration * 0.5)}
                  onClick={(e) => { e.stopPropagation(); const s2 = segments.find(s => s.part === 2 && s.type === 'summary_tts'); onSeek(s2 ? s2.startTime : 0); }}
                  title="分摘要1"
                />
                <SegmentMarker
                  position={50}
                  isActive={currentTime >= (audioDuration * 0.5) && currentTime < (audioDuration * 0.75)}
                  onClick={(e) => { e.stopPropagation(); const s3 = segments.find(s => s.part === 3 && s.type === 'summary_tts'); onSeek(s3 ? s3.startTime : 0); }}
                  title="分摘要2"
                />
                <SegmentMarker
                  position={75}
                  isActive={currentTime >= (audioDuration * 0.75) && currentTime <= audioDuration}
                  onClick={(e) => { e.stopPropagation(); const s4 = segments.find(s => s.part === 4 && s.type === 'summary_tts'); onSeek(s4 ? s4.startTime : 0); }}
                  title="分摘要3"
                />
                {/* 气泡 1/2/3 */}
                <SegmentBubble style={{ left: '25%' }}>1</SegmentBubble>
                <SegmentBubble style={{ left: '50%' }}>2</SegmentBubble>
                <SegmentBubble style={{ left: '75%' }}>3</SegmentBubble>
              </>
            ) : (
              // 无极/非等分：显示实际节点与气泡
              <>
                {partInfo.map((part) => (
                  <SegmentMarker
                    key={part.part}
                    position={(part.startTime / audioDuration) * 100}
                    isActive={currentTime >= part.startTime && (currentTime < part.endTime || (part.part === 4 && currentTime === part.endTime))}
                    onClick={(e) => { e.stopPropagation(); handlePartClick(part); }}
                    title={part.part === 1 ? 'Part 1: 发送人+总摘要' : `分摘要${part.part - 1}`}
                  />
                ))}
                {/* 只为分摘要1/2/3显示气泡 */}
                {partInfo.filter(p => p.part >= 2 && p.part <= 4).map((p) => (
                  <SegmentBubble key={`bubble-${p.part}`} style={{ left: `${(p.startTime / audioDuration) * 100}%` }}>
                    {p.part - 1}
                  </SegmentBubble>
                ))}
              </>
            )}
          </ProgressBar>
          {/* 去掉右侧蓝色秒数 */}
          {/* <DurationInline>{Math.round(audioDuration || 0)}s</DurationInline> */}
        </div>
        <ProgressTime>
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </ProgressTime>
        
        {/* 等分滑动模式下的百分比标签 */}
        {slideMode === 'equal' && (
          <EqualDivisionLabels>
            <DivisionLabel position={0}>0%</DivisionLabel>
            <DivisionLabel position={25}>25%</DivisionLabel>
            <DivisionLabel position={50}>50%</DivisionLabel>
            <DivisionLabel position={75}>75%</DivisionLabel>
            <DivisionLabel position={100}>100%</DivisionLabel>
          </EqualDivisionLabels>
        )}
      </ProgressContainer>

      {/* 四个部分的内容 */}
      <ContentContainer>
        {partInfo.map((part) => (
          <ContentPart key={part.part}>
            <PartHeader>
              <PartTitle>{part.title}</PartTitle>
              <PartTime>{formatTime(part.startTime)} - {formatTime(part.endTime)}</PartTime>
            </PartHeader>
            <PartContent>
              {part.part === 1 ? (
                <div>
                  <SummaryText>{part.summary}</SummaryText>
                </div>
              ) : (
                <div>
                  <SegmentSummary>{part.summary}</SegmentSummary>
                  <OriginalText>{part.original}</OriginalText>
                </div>
              )}
            </PartContent>
          </ContentPart>
        ))}
      </ContentContainer>

      {/* 分段跳转按钮 */}
      <SegmentControls>
        {partInfo.map((part) => (
          <SegmentButton
            key={part.part}
            isActive={currentTime >= part.startTime && (currentTime < part.endTime || (part.part === 4 && currentTime === part.endTime))}
            onClick={(e) => handlePartClickWrapper(e, part)}
          >
            {part.part}
          </SegmentButton>
        ))}
      </SegmentControls>

      {/* 滑动模式选择器 */}
      {showStudyControls && <SlideModeSelector isOwn={isOwn}>
        <SlideModeLabel isOwn={isOwn}>滑动模式：</SlideModeLabel>
        <SlideModeOptions>
          <SlideModeButton
            isActive={slideMode === 'continuous'}
            onClick={() => setSlideMode('continuous')}
          >
            无极滑动
          </SlideModeButton>
          <SlideModeButton
            isActive={slideMode === 'equal'}
            onClick={() => setSlideMode('equal')}
          >
            等分滑动
          </SlideModeButton>
          <SlideModeButton
            isActive={slideMode === 'segmented'}
            onClick={() => setSlideMode('segmented')}
          >
            非等分滑动
          </SlideModeButton>
        </SlideModeOptions>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SlideModeLabel isOwn={isOwn}>跳转判定：</SlideModeLabel>
          <SlideModeButton
            isActive={seekPolicy === 'interval'}
            onClick={() => setSeekPolicy('interval')}
          >区间判定</SlideModeButton>
          <SlideModeButton
            isActive={seekPolicy === 'snap'}
            onClick={() => setSeekPolicy('snap')}
          >吸附判定</SlideModeButton>
        </div>
      </SlideModeSelector>}
    </AudioPlayerContainer>
  );
};




export default AudioPlayer;
