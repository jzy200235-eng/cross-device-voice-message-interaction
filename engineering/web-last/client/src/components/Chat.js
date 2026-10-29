import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FiSend, FiMic, FiPaperclip, FiPlay, FiPause, FiFileText, FiClock, FiUser } from 'react-icons/fi';
import VoiceRecorder from './VoiceRecorder';
import ServerAudioPicker from './ServerAudioPicker';
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
const AudioPlayer = ({ message, isOwn, onPlay, onPause, onSeek, isPlaying, currentTime, duration, socket, slideMode, setSlideMode, seekPolicy, setSeekPolicy, onFocusMessage, hardwareProgressPct }) => {
  const [progress, setProgress] = useState(0);
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
    
    // 节点播报（顺序已在下方 onSeek 定时后处理）
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
        <PlayButton onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
        </PlayButton>
      </AudioHeader>

      {/* 进度条 */}
      <ProgressContainer onClick={handleProgressClick}>
        {/* 滑动模式提示 */}
        <SlideModeHint isOwn={isOwn}>
          {slideMode === 'continuous' && '无极滑动：可自由滑动到任意位置'}
          {slideMode === 'equal' && '等分滑动：四个部分等分，滑动到区间跳到对应部分开始'}
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
                    isActive={currentTime >= part.startTime && currentTime <= part.endTime}
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
            isActive={currentTime >= part.startTime && currentTime <= part.endTime}
            onClick={(e) => handlePartClickWrapper(e, part)}
          >
            {part.part}
          </SegmentButton>
        ))}
      </SegmentControls>

      {/* 滑动模式选择器 */}
      <SlideModeSelector isOwn={isOwn}>
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
      </SlideModeSelector>
    </AudioPlayerContainer>
  );
};



const Chat = ({ currentUser, selectedUser, messages, onSendMessage, onSendVoiceMessage, onSendFile, socket }) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [showAudioSelector, setShowAudioSelector] = useState(false);
  const [availableAudioMessages, setAvailableAudioMessages] = useState([]);
  const [slideMode, setSlideMode] = useState('continuous'); // 新增滑动模式状态
  const [seekPolicy, setSeekPolicy] = useState('interval'); // 跳转判定：interval | snap
  const [hardwareOverlay, setHardwareOverlay] = useState(null); // { messageId, pct, ts }
  const [isUploadingAudio, setIsUploadingAudio] = useState(false); // 音频上传状态
  const [uploadProgress, setUploadProgress] = useState(0); // 上传进度
  const [showServerPicker, setShowServerPicker] = useState(false); // 服务器文件选择器
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  // 硬件拖动状态管理
  const hardwareDragActiveRef = useRef(false);
  const hardwareDragTimerRef = useRef(null);
  const hardwarePrevWasPlayingRef = useRef(false);
  const hardwareLastTargetRef = useRef({ messageId: null, time: 0 });
  const hardwareTouchActiveRef = useRef(false);
  const hardwarePrevTimeMapRef = useRef(new Map()); // per-message 上一帧时间用于跨越检测（硬件）
  const lastAnnouncedTimeByMessageRef = useRef(new Map()); // 每条消息最近一次播报的节点时间
  const playbackSessionIdRef = useRef(0); // 每次开始播放自增，旧回调将被忽略
  const startingGuardRef = useRef(0); // 启动节流，避免短时间多次start
  const lastFocusedMessageIdRef = useRef(null); // 最近与之交互的消息（点击、拖拽等）

  // （移除）节点播报事件不在此处处理，改由子组件 AudioPlayer 监听并执行

  // 发送播放状态更新到服务器
  const sendPlaybackStateUpdate = (messageId, sender, isPlaying) => {
    if (socket) {
      socket.emit('playback_state_update', {
        messageId: messageId,
        sender: sender,
        isPlaying: isPlaying
      });
      console.log('发送播放状态更新:', { messageId, sender, isPlaying });
    }
  };

  // 全局音频播放状态管理
  useEffect(() => {
    // 确保全局只有一个音频在播放
    if (isPlaying && playingMessageId) {
      // 设置全局播放状态
      window.currentPlayingAudio = {
        messageId: playingMessageId,
        timestamp: Date.now()
      };
      
      // 设置长音频播放状态（这是长音频播放器）
      window.currentPlayingLongAudio = {
        messageId: playingMessageId,
        timestamp: Date.now()
      };

      // 发送播放状态更新
      const currentMessage = messages.find(msg => msg.id === playingMessageId);
      if (currentMessage) {
        sendPlaybackStateUpdate(playingMessageId, currentMessage.senderName, true);
      }
    } else {
      // 清除全局播放状态
      window.currentPlayingAudio = null;
      window.currentPlayingLongAudio = null;

      // 发送停止播放状态更新
      if (playingMessageId) {
        const currentMessage = messages.find(msg => msg.id === playingMessageId);
        if (currentMessage) {
          sendPlaybackStateUpdate(playingMessageId, currentMessage.senderName, false);
        }
      }
    }
    
    return () => {
      // 组件卸载时清理全局状态
      if (window.currentPlayingAudio && window.currentPlayingAudio.messageId === playingMessageId) {
        window.currentPlayingAudio = null;
      }
      if (window.currentPlayingLongAudio && window.currentPlayingLongAudio.messageId === playingMessageId) {
        window.currentPlayingLongAudio = null;
      }
    };
  }, [isPlaying, playingMessageId, messages, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // 清理音频播放器
    return () => {
      if (audioRef.current) {
        if (audioRef.current.isRealAudio && audioRef.current.audio) {
          try { audioRef.current.audio.pause(); } catch (e) {}
        } else if (audioRef.current.interval) {
          try { clearInterval(audioRef.current.interval); } catch (e) {}
          audioRef.current.interval = null;
        }
        audioRef.current = null;
      }
    };
  }, []);

  // 添加滑动位置监听
  useEffect(() => {
    if (socket) {
      // 监听滑动位置更新
      socket.on('slider_position_update', (data) => {
        console.log('收到滑动位置更新:', data.position + '%', '来源:', data.source);
        
        // 硬件拖动：仅更新进度，不触发播放；在松手后再跳转并按需恢复播放
        if (data && data.source === 'hardware') {
          let targetMessage = null;
          // 仅选中"正在播放"的语音消息作为目标
          if (playingMessageId) {
            targetMessage = messages.find(msg => msg.id === playingMessageId && msg.type === 'voice');
          }
          if (!targetMessage) {
            return; // 无正在播放的语音则忽略
          }
          if (targetMessage && targetMessage.type === 'voice') {
            const totalDuration = targetMessage.audioMetadata?.audio_duration_sec || 
                                 targetMessage.summary?.audio_duration_sec || 
                                 60;
            const pct = Math.max(0, Math.min(100, data.position || 0));
            // 计算目标时间（用于松手后的跳转）
            let newTime = 0;
            const segs = Array.isArray(targetMessage.audioMetadata?.segments) ? targetMessage.audioMetadata.segments : [];
            if (slideMode === 'equal' && segs.length > 0) {
              // 等分：始终回到区间起点（0/25/50/75% 对应 part1..part4 的 start）
              const partsMap = new Map();
              segs.forEach(s => {
                const part = s.part;
                if (!partsMap.has(part)) partsMap.set(part, { startTime: Number.POSITIVE_INFINITY });
                const rec = partsMap.get(part);
                const st = s.start_time ?? s.startTime;
                if (typeof st === 'number' && st < rec.startTime) rec.startTime = st;
              });
              const p1 = partsMap.get(1), p2 = partsMap.get(2), p3 = partsMap.get(3), p4 = partsMap.get(4);
              if (pct <= 25) newTime = p1?.startTime ?? 0;
              else if (pct <= 50) newTime = p2?.startTime ?? 0;
              else if (pct <= 75) newTime = p3?.startTime ?? 0;
              else newTime = p4?.startTime ?? 0;
              if (typeof newTime !== 'number') newTime = (pct / 100) * totalDuration;
            } else if (slideMode === 'segmented' && segs.length > 0) {
              const tRaw = (pct / 100) * totalDuration;
              const originalSegs = segs.filter(s => s.type === 'original_audio');
              const hitOriginal = originalSegs.find(s => tRaw >= (s.start_time ?? s.startTime) && tRaw <= (s.end_time ?? s.endTime));
              if (hitOriginal) {
                const partNum = hitOriginal.part;
                const summarySeg = segs.find(s => s.part === partNum && s.type === 'summary_tts');
                newTime = summarySeg ? (summarySeg.start_time ?? summarySeg.startTime ?? 0) : (hitOriginal.start_time ?? hitOriginal.startTime ?? 0);
              } else {
                newTime = (pct / 100) * totalDuration;
              }
            } else {
              newTime = (pct / 100) * totalDuration;
            }

            // UI即时显示硬件进度覆盖
            try { setHardwareOverlay({ messageId: targetMessage.id, pct, ts: Date.now() }); } catch(_) {}

            // 硬件有输入：若正在播放则先暂停
            if (!hardwareDragActiveRef.current) {
              hardwareDragActiveRef.current = true;
              hardwarePrevWasPlayingRef.current = isPlaying;
              if (isPlaying) pauseAudioPlayback();
            }

            // 记录最近目标，用于松手后跳转
            hardwareLastTargetRef.current = { messageId: targetMessage.id, time: newTime };

            // 不使用超时；改由硬件触摸状态事件控制松手逻辑
            return; // 不立即跳转、不播放
          }
        }

        // 网页端或其它来源：保持原有行为
        if (data && data.source !== 'hardware') {
          let targetMessage = null;
          if (playingMessageId) {
            targetMessage = messages.find(msg => msg.id === playingMessageId);
          }
          if (!targetMessage) {
            targetMessage = messages.find(msg => msg.type === 'voice');
          }
          if (targetMessage && targetMessage.type === 'voice') {
            const totalDuration = targetMessage.audioMetadata?.audio_duration_sec || 
                                 targetMessage.summary?.audio_duration_sec || 
                                 60;
            const newTime = (data.position / 100) * totalDuration;
            console.log('外部控制音频跳转到:', newTime + 's', '来源:', data.source);
            handleAudioSeek(targetMessage, newTime);
          }
        }
      });

      // 监听停止其他音频的信号
      socket.on('stop_other_audio', (data) => {
        console.log('收到停止其他音频信号:', data.messageId);
        // 如果当前播放的不是这个音频，继续播放
        if (playingMessageId !== data.messageId) {
          console.log('继续播放当前音频:', playingMessageId);
          return;
        }
        
        // 如果当前播放的是这个音频，停止播放
        console.log('停止当前音频播放:', playingMessageId);
        stopAudioPlayback();
      });

      // 监听停止其他长音频的信号
      socket.on('stop_other_long_audio', (data) => {
        console.log('收到停止其他长音频信号:', data.messageId);
        // 如果当前播放的不是这个音频，继续播放
        if (playingMessageId !== data.messageId) {
          console.log('继续播放当前长音频:', playingMessageId);
          return;
        }
        
        // 如果当前播放的是这个音频，停止播放
        console.log('停止当前长音频播放:', playingMessageId);
        stopAudioPlayback();
      });

      // 监听暂停长音频的信号
      socket.on('pause_long_audio', (data) => {
        console.log('收到暂停长音频信号:', data.messageId);
        // 如果当前播放的是这个音频，暂停播放
        if (playingMessageId === data.messageId && isPlaying) {
          console.log('暂停当前长音频播放:', playingMessageId);
          // 暂停但不停止，保持状态
          if (audioRef.current && audioRef.current.isRealAudio && audioRef.current.audio) {
            audioRef.current.audio.pause();
          }
          setIsPlaying(false);
        }
      });

      // 监听恢复长音频的信号
      socket.on('resume_long_audio', (data) => {
        console.log('收到恢复长音频信号:', data.messageId);
        // 如果当前应该播放的是这个音频，恢复播放
        if (playingMessageId === data.messageId && !isPlaying) {
          console.log('恢复当前长音频播放:', playingMessageId);
          if (audioRef.current && audioRef.current.isRealAudio && audioRef.current.audio) {
            audioRef.current.audio.play().then(() => {
              setIsPlaying(true);
            }).catch(error => {
              console.error('恢复长音频播放失败:', error);
            });
          }
        }
      });

      // 监听停止其他段音频的信号
      socket.on('stop_other_segment_audio', (data) => {
        console.log('收到停止其他段音频信号:', data.messageId);
        // 如果当前播放的是这个音频，停止播放
        if (playingMessageId === data.messageId) {
          console.log('停止当前段音频播放:', playingMessageId);
          stopAudioPlayback();
        }
      });

      // 监听连续滑动更新事件
      socket.on('continuous_slider_update', (data) => {
        console.log('收到连续滑动更新:', data.position + '%', '变化量:', data.delta.toFixed(2) + '%', '来源:', data.source);
        
        // 处理连续滑动数据 - 实现平滑的拖动效果
        if (data && data.source === 'hardware') {
          let targetMessage = null;
          // 仅选中"正在播放"的语音消息作为目标
          if (playingMessageId) {
            targetMessage = messages.find(msg => msg.id === playingMessageId && msg.type === 'voice');
          }
          if (!targetMessage) {
            return; // 无正在播放的语音则忽略
          }
          
          if (targetMessage && targetMessage.type === 'voice') {
            const totalDuration = targetMessage.audioMetadata?.audio_duration_sec || 
                                 targetMessage.summary?.audio_duration_sec || 
                                 60;
            const pct = Math.max(0, Math.min(100, data.position || 0));
            let newTime = 0;
            
            // 根据滑动模式计算目标时间（不依赖子组件作用域）
            const segs = Array.isArray(targetMessage.audioMetadata?.segments) ? targetMessage.audioMetadata.segments : [];
            if (slideMode === 'equal' && segs.length > 0) {
              // 等分：始终回到区间起点（0/25/50/75% 对应 part1..part4 的 start）
              const partsMap = new Map();
              segs.forEach(s => {
                const part = s.part;
                if (!partsMap.has(part)) partsMap.set(part, { startTime: Number.POSITIVE_INFINITY });
                const rec = partsMap.get(part);
                const st = s.start_time ?? s.startTime;
                if (typeof st === 'number' && st < rec.startTime) rec.startTime = st;
              });
              const p1 = partsMap.get(1), p2 = partsMap.get(2), p3 = partsMap.get(3), p4 = partsMap.get(4);
              if (pct <= 25) newTime = p1?.startTime ?? 0;
              else if (pct <= 50) newTime = p2?.startTime ?? 0;
              else if (pct <= 75) newTime = p3?.startTime ?? 0;
              else newTime = p4?.startTime ?? 0;
              if (typeof newTime !== 'number') newTime = (pct / 100) * totalDuration;
            } else if (slideMode === 'segmented' && segs.length > 0) {
              const tRaw = (pct / 100) * totalDuration;
              const originalSegs = segs.filter(s => s.type === 'original_audio');
              const hitOriginal = originalSegs.find(s => tRaw >= (s.start_time ?? s.startTime) && tRaw <= (s.end_time ?? s.endTime));
              if (hitOriginal) {
                const partNum = hitOriginal.part;
                const summarySeg = segs.find(s => s.part === partNum && s.type === 'summary_tts');
                newTime = summarySeg ? (summarySeg.start_time ?? summarySeg.startTime ?? 0) : (hitOriginal.start_time ?? hitOriginal.startTime ?? 0);
              } else {
                newTime = (pct / 100) * totalDuration;
              }
            } else {
              newTime = (pct / 100) * totalDuration;
            }

            // UI即时显示硬件进度覆盖
            try { setHardwareOverlay({ messageId: targetMessage.id, pct, ts: Date.now() }); } catch(_) {}

            // 硬件有输入：若正在播放则先暂停
            if (!hardwareDragActiveRef.current) {
              hardwareDragActiveRef.current = true;
              hardwarePrevWasPlayingRef.current = isPlaying;
              if (isPlaying) pauseAudioPlayback();
            }

            // 实时跳转到硬件位置
            try { handleAudioSeek(targetMessage, newTime); } catch(_) {}

            // 仍记录最近目标，作为松手后的兜底
            hardwareLastTargetRef.current = { messageId: targetMessage.id, time: newTime };

            // 完全对齐网页端：在父组件使用“时间版”跨越检测并立即触发播报事件
            try {
              const prevTime = hardwarePrevTimeMapRef.current.get(targetMessage.id) ?? newTime;
              const total = totalDuration || 0;
              if (total > 0) {
                const currPct = newTime / total;
                const prevPct = prevTime / total;
                if (currPct !== prevPct) {
                  const low = Math.min(prevPct, currPct);
                  const high = Math.max(prevPct, currPct);
                  let crossedNode = null;
                  if (slideMode === 'equal') {
                    // 等分模式：使用和非等分一样的逻辑，检测实际音频元数据的节点
                    // UI上显示等分，但播报逻辑基于真实数据
                    const segs = Array.isArray(targetMessage.audioMetadata?.segments) ? targetMessage.audioMetadata.segments : [];
                    const starts = segs
                      .filter(s => typeof (s.start_time ?? s.startTime) === 'number' && s.part >= 2 && s.part <= 4 && (s.type === 'summary_tts' || s.type === 'summary'))
                      .map(s => ({ part: s.part, start: (s.start_time ?? s.startTime) / total }))
                      .sort((a,b)=>a.start-b.start);
                    const crossed = starts.filter(s => s.start > low && s.start <= high);
                    if (crossed.length > 0) {
                      const forward = currPct > prevPct;
                      const node = forward ? crossed[crossed.length - 1] : crossed[0];
                      crossedNode = { type: 'equal', position: node.start * 100, part: node.part };
                    }
                  } else {
                    const segs = Array.isArray(targetMessage.audioMetadata?.segments) ? targetMessage.audioMetadata.segments : [];
                    const starts = segs
                      .filter(s => typeof (s.start_time ?? s.startTime) === 'number' && s.part >= 2 && s.part <= 4 && (s.type === 'summary_tts' || s.type === 'summary'))
                      .map(s => ({ part: s.part, start: (s.start_time ?? s.startTime) / total }))
                      .sort((a,b)=>a.start-b.start);
                    const crossed = starts.filter(s => s.start > low && s.start <= high);
                    if (crossed.length > 0) {
                      const forward = currPct > prevPct;
                      const node = forward ? crossed[crossed.length - 1] : crossed[0];
                      crossedNode = { type: 'actual', position: node.start * 100, part: node.part };
                    }
                  }
                  if (crossedNode) {
                    // 仅在真正“穿越”节点（无滞回带）时播报，并携带方向信息
                    const NODE_PCT = (crossedNode.position || 0) / 100;
                    const HYST = 0.00; // 滞回带已关闭
                    const fromLeft = (prevPct <= NODE_PCT - HYST) && (currPct >= NODE_PCT + HYST);
                    const fromRight = (prevPct >= NODE_PCT + HYST) && (currPct <= NODE_PCT - HYST);
                    if (fromLeft || fromRight) {
                      const direction = currPct > prevPct ? 'forward' : 'backward';
                      const payload = { ...crossedNode, direction };
                      window.dispatchEvent(new CustomEvent('announce_node', { detail: { messageId: targetMessage.id, nodeInfo: payload } }));
                    }
                  }
                }
              }
              hardwarePrevTimeMapRef.current.set(targetMessage.id, newTime);
            } catch(_) {}

            // 不使用超时；改由硬件触摸状态事件控制松手逻辑
          }
        }
      });

      // 监听硬件触摸状态（active=false 表示松手）
      socket.on('hardware_touch_state', (data) => {
        if (!data) return;
        if (data.active) {
          hardwareTouchActiveRef.current = true;
          return;
        }
        // 松手：对最近目标执行跳转并根据之前状态恢复播放
        hardwareTouchActiveRef.current = false;
        if (hardwareDragActiveRef.current) {
          hardwareDragActiveRef.current = false;
          const last = hardwareLastTargetRef.current;
          if (last && last.messageId) {
            const targetMessage = messages.find(m => m.id === last.messageId);
            if (targetMessage) {
              // 吸附判定：优先跳到最近一次播报的节点
              const snapTime = (seekPolicy === 'snap') ? lastAnnouncedTimeByMessageRef.current.get(targetMessage.id) : null;
              const finalTime = (typeof snapTime === 'number') ? snapTime : last.time;
              handleAudioSeek(targetMessage, finalTime);
              if (hardwarePrevWasPlayingRef.current) {
                resumeAudioPlayback();
              }
            }
          }
          try { setHardwareOverlay(null); } catch(_) {}
        }
      });

      return () => {
        socket.off('slider_position_update');
        socket.off('stop_other_audio');
        socket.off('stop_other_long_audio');
        socket.off('pause_long_audio');
        socket.off('resume_long_audio');
        socket.off('stop_other_segment_audio');
        socket.off('continuous_slider_update');
        socket.off('hardware_touch_state');
      };
    }
  }, [socket, playingMessageId, isPlaying, messages]);

  // 监听节点播报事件，记录最近一次播报节点对应的时间（用于吸附判定）
  useEffect(() => {
    const onAnnounce = (e) => {
      try {
        const { messageId, nodeInfo } = e.detail || {};
        if (!messageId || !nodeInfo) return;
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;
        // 将 nodeInfo 映射为具体时间
        let timeSec = 0;
        const total = msg.audioMetadata?.audio_duration_sec || msg.summary?.audio_duration_sec || 0;
        if (slideMode === 'equal') {
          // 等分：节点对应各 part 的起始时间（取每个 part 的最早 start）
          const segs = Array.isArray(msg.audioMetadata?.segments) ? msg.audioMetadata.segments : [];
          const partsMap = new Map();
          segs.forEach(s => {
            const part = s.part;
            if (!partsMap.has(part)) partsMap.set(part, { startTime: Number.POSITIVE_INFINITY });
            const rec = partsMap.get(part);
            const st = s.start_time ?? s.startTime;
            if (typeof st === 'number' && st < rec.startTime) rec.startTime = st;
          });
          const p = partsMap.get(nodeInfo.part);
          if (p && typeof p.startTime === 'number' && isFinite(p.startTime)) {
            timeSec = p.startTime;
          } else if (total > 0) {
            timeSec = (nodeInfo.position / 100) * total;
          }
        } else {
          // 非等分：直接取该 part 的 summary_tts 起点；缺失则按百分比回退
          const segs = Array.isArray(msg.audioMetadata?.segments) ? msg.audioMetadata.segments : [];
          const part = nodeInfo.part;
          const summarySeg = segs.find(s => s.part === part && s.type === 'summary_tts');
          if (summarySeg) {
            timeSec = summarySeg.start_time ?? summarySeg.startTime ?? 0;
          } else if (total > 0) {
            timeSec = (nodeInfo.position / 100) * total;
          }
        }
        lastAnnouncedTimeByMessageRef.current.set(messageId, timeSec);
      } catch(_) {}
    };
    window.addEventListener('announce_node', onAnnounce);
    return () => window.removeEventListener('announce_node', onAnnounce);
  }, [messages, slideMode]);

  // 加载可用的音频消息
  useEffect(() => {
    const loadAudioMessages = async () => {
      try {
        console.log('正在加载音频消息...');
        const response = await fetch(`${config.apiBaseUrl}/api/audio/messages`); // 使用配置文件中的地址
        if (response.ok) {
          const data = await response.json();
          console.log('加载到的音频消息:', data);
          setAvailableAudioMessages(data);
        } else {
          console.error('加载音频消息失败:', response.status);
          // 如果API失败，尝试从当前用户的消息中获取音频消息
          const currentUserMessages = messages.filter(msg => msg.type === 'voice');
          console.log('从当前消息中获取音频消息:', currentUserMessages);
          setAvailableAudioMessages(currentUserMessages);
        }
      } catch (error) {
        console.error('加载音频消息失败:', error);
        // 如果API失败，尝试从当前用户的消息中获取音频消息
        const currentUserMessages = messages.filter(msg => msg.type === 'voice');
        console.log('从当前消息中获取音频消息:', currentUserMessages);
        setAvailableAudioMessages(currentUserMessages);
      }
    };
    loadAudioMessages();
  }, [messages]); // 添加messages作为依赖，当消息更新时重新加载

  // 添加调试信息
  useEffect(() => {
    console.log('showAudioSelector:', showAudioSelector);
    console.log('availableAudioMessages:', availableAudioMessages);
  }, [showAudioSelector, availableAudioMessages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceRecord = (audioBlob, duration) => {
    setIsRecording(false);
    const reader = new FileReader();
    reader.onload = () => {
      const audioData = reader.result;
      onSendVoiceMessage(audioData, duration);
    };
    reader.readAsDataURL(audioBlob);
  };

  // 从服务器选择器回调：把处理结果注入为一条语音消息
  const handleServerAudioPicked = ({ root, relativePath, fileName, summary }) => {
    try {
      if (!selectedUser || !currentUser || !socket) return;
      
      const audioDuration = summary?.audio_duration_sec || 30;
      
      // 按照现有voice_message的格式发送
      const voiceData = {
        targetUserId: selectedUser.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderImg: currentUser.avatar || '',
        audioData: `data:audio/mp3;base64,${btoa('server_file')}`, // 占位符，使用btoa替代Buffer
        duration: audioDuration,
        // 添加服务器文件信息
        serverFileInfo: {
          source: 'server_file',
          root,
          relativePath,
          filename: fileName
        }
      };
      
      // 通过socket发送，与现有语音消息流程一致
      socket.emit('voice_message', voiceData);
      
      console.log('服务器音频处理成功，已发送语音消息:', voiceData);
    } catch (error) {
      console.error('处理服务器音频结果失败:', error);
      alert(`处理失败: ${error.message}`);
    } finally {
      setShowServerPicker(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 检查是否为音频文件
      if (file.type.startsWith('audio/') || 
          file.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|ogg|aac)$/)) {
        handleAudioFileUpload(file);
      } else {
        // 普通文件处理
        const reader = new FileReader();
        reader.onload = () => {
          const fileData = reader.result;
          onSendFile(file.name, fileData, file.type);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleAudioFileUpload = async (file) => {
    try {
      setIsUploadingAudio(true);
      setUploadProgress(0);

      // 检查文件大小（限制50MB）
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        alert('音频文件过大，请选择小于50MB的文件');
        return;
      }

      // 读取文件为base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioData = e.target.result;
          setUploadProgress(30);

          // 发送到服务器处理
          const response = await fetch(`${config.apiBaseUrl}/api/summarize/voice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioData: audioData
            })
          });

          setUploadProgress(70);

          if (!response.ok) {
            throw new Error(`上传失败: ${response.status}`);
          }

          const result = await response.json();
          setUploadProgress(100);

          if (result.success) {
            // 创建语音消息
            const voiceMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 添加ID字段
              senderId: currentUser.id, // 修复：应该是当前用户发送
              senderName: currentUser.name,
              senderImg: currentUser.avatar,
              content: JSON.stringify({ 
                audioData: audioData, 
                duration: result.audio_duration_sec || 30,
                filename: file.name
              }),
              type: 'voice',
              me: true,
              summary: result,
              timestamp: new Date().toISOString(),
              time: new Date().toLocaleString('zh-CN', {
                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
              }).replace(/\//g, '/'),
              audioMetadata: {
                sender: currentUser.name, // 修复：应该是当前用户
                role: 'user',
                filename: file.name,
                audio_duration_sec: result.audio_duration_sec || 30,
                msg_type: result.msg_type || 'task',
                emotion: result.emotion || '中性',
                segments: result.segments || [],
                overall_summary: result.overall_summary || result.summary
              }
            };

            // 添加到消息列表
            if (onSendMessage) {
              onSendMessage('__AUDIO_MESSAGE__', voiceMessage);
            }

            console.log('音频上传成功:', voiceMessage);
          } else {
            throw new Error(result.error || '音频处理失败');
          }
        } catch (error) {
          console.error('音频上传处理失败:', error);
          alert(`音频上传失败: ${error.message}`);
        } finally {
          setIsUploadingAudio(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        console.error('文件读取失败');
        alert('文件读取失败');
        setIsUploadingAudio(false);
        setUploadProgress(0);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('音频上传失败:', error);
      alert(`音频上传失败: ${error.message}`);
      setIsUploadingAudio(false);
      setUploadProgress(0);
    }
  };

  const handleAudioMessageSelect = async (audioMessage) => {
    try {
      // 直接在当前聊天中添加选中的音频消息（作为对方发送的消息）
      const newMessage = {
        ...audioMessage,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        me: false, // 标记为对方发送的消息
        senderId: selectedUser.id,
        senderName: selectedUser.name,
        senderImg: selectedUser.avatar,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleString('zh-CN', {
          year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(/\//g, '/')
      };
      
      // 通知父组件更新消息列表
      if (onSendMessage) {
        onSendMessage('__AUDIO_MESSAGE__', newMessage);
      }
      
      setShowAudioSelector(false);
      console.log('音频消息已添加到聊天:', newMessage);
    } catch (error) {
      console.error('添加音频消息错误:', error);
    }
  };

  const handleVoicePlay = (message) => {
    if (playingMessageId === message.id) {
      // 同一条消息：播放键作为继续播放
      resumeAudioPlayback();
    } else {
      // 开始播放新的消息
      startAudioPlayback(message);
    }
  };

  const clearPendingAutoResume = () => {
    if (window.pendingResumePlaybackTimer) {
      clearTimeout(window.pendingResumePlaybackTimer);
      window.pendingResumePlaybackTimer = null;
      window.pendingResumePlaybackForMessageId = null;
    }
  };

  const pauseAudioPlayback = () => {
    console.log('暂停音频播放');
    clearPendingAutoResume();
    if (audioRef.current) {
      if (audioRef.current.isRealAudio && audioRef.current.audio) {
        audioRef.current.audio.pause();
      } else if (audioRef.current.interval) {
        clearInterval(audioRef.current.interval);
        audioRef.current.interval = null;
      }
      setIsPlaying(false);
    }
  };

  const resumeAudioPlayback = () => {
    console.log('继续音频播放');
    clearPendingAutoResume();
    if (!audioRef.current || !playingMessageId) return;
    if (audioRef.current.isRealAudio && audioRef.current.audio) {
      audioRef.current.audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error('继续播放失败:', err));
    } else {
      const totalDuration = duration || 60;
      const playInterval = setInterval(() => {
        setCurrentTime(prevTime => {
          const newTime = prevTime + 0.1;
          if (newTime >= totalDuration) {
            clearInterval(playInterval);
            setIsPlaying(false);
            setPlayingMessageId(null);
            setCurrentTime(0);
            audioRef.current = null;
            return 0;
          }
          return newTime;
        });
      }, 100);
      audioRef.current.interval = playInterval;
      setIsPlaying(true);
    }
  };

  const handleVoicePause = () => {
    // 改为真正的暂停，不归零
    pauseAudioPlayback();
  };

  const startAudioPlayback = (message, startAtSec) => {
    const now = Date.now();
    if (now - startingGuardRef.current < 200) {
      console.log('快速重复启动被忽略');
      return;
    }
    startingGuardRef.current = now;

    console.log('开始播放音频:', message.id, startAtSec != null ? `从 ${startAtSec}s` : '');
    clearPendingAutoResume();

    const sessionId = ++playbackSessionIdRef.current;
    
    // 检查全局播放状态，如果有其他音频在播放，先停止
    if (window.currentPlayingAudio && window.currentPlayingAudio.messageId !== message.id) {
      console.log('检测到其他音频正在播放，先停止:', window.currentPlayingAudio.messageId);
      if (socket) {
        socket.emit('stop_other_audio', {
          messageId: window.currentPlayingAudio.messageId,
          timestamp: Date.now()
        });
      }
    }
    
    if (window.currentPlayingLongAudio && window.currentPlayingLongAudio.messageId !== message.id) {
      console.log('检测到其他长音频正在播放，先停止:', window.currentPlayingLongAudio.messageId);
      if (socket) {
        socket.emit('stop_other_long_audio', {
          messageId: window.currentPlayingLongAudio.messageId,
          timestamp: Date.now()
        });
      }
    }
    
    // 先停止当前播放
    if (audioRef.current && audioRef.current.messageId !== message.id) {
      console.log('停止当前播放');
      stopAudioPlayback();
    }
    
    try {
      const voiceData = JSON.parse(message.content);
      const totalDuration = message.audioMetadata?.audio_duration_sec || 
                           message.summary?.audio_duration_sec || 
                           voiceData.duration || 60;
      const startAt = Math.max(0, Math.min(startAtSec ?? 0, totalDuration));
      
      if (voiceData.audioData && (voiceData.audioData.startsWith('file://') || voiceData.audioData.startsWith('/audio'))) {
        const audio = new Audio();
        audio.src = voiceData.audioData;
        
        audio.onloadedmetadata = () => {
          if (sessionId !== playbackSessionIdRef.current) return; // 旧回调忽略
          setDuration(audio.duration);
          try { audio.currentTime = startAt; } catch (e) {}
        };
        
        audio.ontimeupdate = () => {
          if (sessionId !== playbackSessionIdRef.current) return;
          if (hardwareTouchActiveRef.current) return; // 按住硬件拖动时不更新，以免回跳
          setCurrentTime(audio.currentTime);
        };
        
        audio.onended = () => {
          if (sessionId !== playbackSessionIdRef.current) return;
          setIsPlaying(false);
          setPlayingMessageId(null);
          setCurrentTime(0);
        };
        
        audio.onerror = (error) => {
          if (sessionId !== playbackSessionIdRef.current) return;
          console.error('真实音频播放错误:', error);
          startSimulatedPlayback(message, totalDuration, startAt);
        };
        
        audio.play().then(() => {
          if (sessionId !== playbackSessionIdRef.current) {
            try { audio.pause(); } catch(e) {}
            return;
          }
          setIsPlaying(true);
          setPlayingMessageId(message.id);
          if (!isNaN(startAt)) {
            try { audio.currentTime = startAt; } catch (e) {}
          }
          audioRef.current = {
            audio,
            messageId: message.id,
            isRealAudio: true
          };
        }).catch(error => {
          if (sessionId !== playbackSessionIdRef.current) return;
          console.error('真实音频播放失败:', error);
          startSimulatedPlayback(message, totalDuration, startAt);
        });
      } else {
        startSimulatedPlayback(message, totalDuration, startAt, sessionId);
      }
    } catch (error) {
      console.error('Error starting audio playback:', error);
    }
  };

  const startSimulatedPlayback = (message, totalDuration, startAt = 0, sessionIdParam) => {
    const sessionId = sessionIdParam ?? (++playbackSessionIdRef.current);
    console.log('开始模拟播放，时长:', totalDuration, '起始于:', startAt, 'session:', sessionId);
    setIsPlaying(true);
    setPlayingMessageId(message.id);
    setDuration(totalDuration);
    setCurrentTime(startAt);
    
    const playInterval = setInterval(() => {
      if (sessionId !== playbackSessionIdRef.current) { clearInterval(playInterval); return; }
      if (hardwareTouchActiveRef.current) return; // 硬件拖动时不推进时间，避免回跳
      setCurrentTime(prevTime => {
        const newTime = prevTime + 0.1;
        if (newTime >= totalDuration) {
          clearInterval(playInterval);
          if (sessionId !== playbackSessionIdRef.current) return prevTime;
          setIsPlaying(false);
          setPlayingMessageId(null);
          setCurrentTime(0);
          return 0;
        }
        return newTime;
      });
    }, 100);
    
    audioRef.current = {
      interval: playInterval,
      messageId: message.id,
      isRealAudio: false
    };
  };

  const stopAudioPlayback = () => {
    console.log('停止音频播放');
    clearPendingAutoResume();
    
    // 发送停止播放状态更新
    if (playingMessageId) {
      const currentMessage = messages.find(msg => msg.id === playingMessageId);
      if (currentMessage) {
        sendPlaybackStateUpdate(playingMessageId, currentMessage.senderName, false);
      }
    }
    
    if (audioRef.current) {
      if (audioRef.current.isRealAudio && audioRef.current.audio) {
        console.log('停止真实音频');
        audioRef.current.audio.pause();
      } else if (audioRef.current.interval) {
        console.log('停止模拟播放');
        clearInterval(audioRef.current.interval);
        audioRef.current.interval = null;
      }
    }
    
    setIsPlaying(false);
    setPlayingMessageId(null);
  };

  const handleAudioSeek = (message, newTime) => {
    console.log('跳转到时间:', newTime, '消息ID:', message.id);
    
    // 获取音频总时长
    const totalDuration = message.audioMetadata?.audio_duration_sec || 
                         message.summary?.audio_duration_sec || 
                         60;
    
    // 确保时间在有效范围内
    const seekTime = Math.max(0, Math.min(newTime, totalDuration));
    console.log('实际跳转时间:', seekTime, '总时长:', totalDuration);
    
    // 如果当前正在播放这个消息，直接跳转
    if (playingMessageId === message.id) {
      console.log('当前正在播放，直接跳转');
      setCurrentTime(seekTime);
      
      if (audioRef.current && audioRef.current.isRealAudio && audioRef.current.audio) {
        // 真实音频跳转
        console.log('真实音频跳转');
        audioRef.current.audio.currentTime = seekTime;
      } else if (audioRef.current) {
        // 模拟音频跳转 - 不要创建新 interval，由 resume 再创建
        console.log('模拟音频跳转，暂停后设置时间');
      }
    } else {
      // 如果当前没有播放这个音频，直接从目标时间开始播放
      console.log('当前未播放，从目标时间开始播放');
      startAudioPlayback(message, seekTime);
    }
  };

  const handleFileDownload = (message) => {
    try {
      const fileData = JSON.parse(message.content);
      const link = document.createElement('a');
      link.href = fileData.fileData;
      link.download = fileData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  };

  const renderSummary = (message, isOwn) => {
    const summaryText =
      message?.audioMetadata?.overall_summary ||
      message?.summary?.summary ||
      (Array.isArray(message?.summary?.highlights) && message.summary.highlights[0]?.summary_text) ||
      '';

    if (!summaryText) {
      return null;
    }

    // 获取消息类型和情感信息
    const msgType = message?.summary?.msg_type || message?.audioMetadata?.msg_type || 'task';
    const emotion = message?.summary?.emotion || message?.audioMetadata?.emotion || '中性';
    
    // 消息类型标签样式
    const getMsgTypeStyle = (type) => {
      switch(type) {
        case 'task': return { background: '#007AFF', color: 'white', text: '任务' };
        case 'notice': return { background: '#FF9500', color: 'white', text: '通知' };
        case 'chitchat': return { background: '#34C759', color: 'white', text: '闲聊' };
        default: return { background: '#8E8E93', color: 'white', text: '其他' };
      }
    };

    const msgTypeStyle = getMsgTypeStyle(msgType);

    return (
      <SummaryContainer isOwn={isOwn}>
        <SummaryHeader isOwn={isOwn}>
          <FiFileText size={12} />
          智能摘要
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginLeft: 'auto',
            alignItems: 'center'
          }}>
            <span style={{
              background: msgTypeStyle.background,
              color: msgTypeStyle.color,
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              {msgTypeStyle.text}
            </span>
            <span style={{
              background: emotion === '积极' ? '#34C759' : emotion === '消极' ? '#FF3B30' : '#8E8E93',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              {emotion}
            </span>
          </div>
        </SummaryHeader>
        <SummaryText isOwn={isOwn}>
          {summaryText}
        </SummaryText>
        {message?.summary?.transcript && (
          <TranscriptText isOwn={isOwn}>
            原文: {message.summary.transcript}
          </TranscriptText>
        )}
        {message?.summary?.highlights && message.summary.highlights.length > 0 && (
          <HighlightsContainer isOwn={isOwn}>
            {message.summary.highlights.map((highlight, index) => (
              <HighlightItem key={index} isOwn={isOwn}>
                <FiClock size={10} />
                {highlight.summary_text} ({highlight.duration_sec.toFixed(1)}s)
              </HighlightItem>
            ))}
          </HighlightsContainer>
        )}
      </SummaryContainer>
    );
  };

  const renderAudioMetadata = (message, isOwn) => {
    if (!message.audioMetadata) {
      return null;
    }

    const metadata = message.audioMetadata;
    
    return (
      <AudioMetadata isOwn={isOwn}>
        <MetadataRow>
          <FiUser size={10} />
          {metadata.sender} ({metadata.role})
        </MetadataRow>
        <MetadataRow>
          <FiClock size={10} />
          时长: {metadata.audio_duration_sec.toFixed(1)}秒
        </MetadataRow>
        <MetadataRow>
          📁 {metadata.filename}
        </MetadataRow>
      </AudioMetadata>
    );
  };

  const renderMessage = (message) => {
    const isOwn = message.me;
    
    if (message.type === 'voice') {
      // 获取音频时长
      const getMessageDuration = () => {
        if (message.audioMetadata?.audio_duration_sec) return message.audioMetadata.audio_duration_sec;
        if (message.summary?.audio_duration_sec) return message.summary.audio_duration_sec;
        try {
          const voiceData = JSON.parse(message.content);
          return voiceData.duration || 0;
        } catch (error) {
          return 0;
        }
      };
      
      const messageDuration = getMessageDuration();
      
      // 判断音频类型：长音频还是段音频
      const isLongAudio = messageDuration > 30 || message.audioMetadata?.segments?.length > 1;
      
      if (isLongAudio) {
        // 长音频使用AudioPlayer
        return (
          <AudioPlayer
            message={message}
            isOwn={isOwn}
            onPlay={() => handleVoicePlay(message)}
            onPause={handleVoicePause}
            onSeek={(newTime) => handleAudioSeek(message, newTime)}
            isPlaying={playingMessageId === message.id && isPlaying}
            currentTime={currentTime}
            duration={duration || messageDuration}
            socket={socket}
            slideMode={slideMode} // 传递滑动模式
            setSlideMode={setSlideMode} // 传递设置滑动模式的方法
            seekPolicy={seekPolicy}
            setSeekPolicy={setSeekPolicy}
            onFocusMessage={(id) => { lastFocusedMessageIdRef.current = id; }}
            hardwareProgressPct={hardwareOverlay && hardwareOverlay.messageId === message.id ? hardwareOverlay.pct : null}
          />
        );
      } else {
        // 段音频使用SegmentAudioPlayer
        return (
          <SegmentAudioPlayer
            message={message}
            isOwn={isOwn}
            onPlay={() => handleVoicePlay(message)}
            onPause={handleVoicePause}
            isPlaying={playingMessageId === message.id && isPlaying}
            socket={socket}
          />
        );
      }
    }
    
    if (message.type === 'file') {
      return (
        <FileMessage onClick={() => handleFileDownload(message)}>
          <FileIcon>📎</FileIcon>
          <FileInfo>
            <FileName>{message.fileData?.fileName || '文件'}</FileName>
            <FileSize>点击下载</FileSize>
          </FileInfo>
        </FileMessage>
      );
    }
    
    return (
      <div>
        <div>{message.content}</div>
        {renderSummary(message, isOwn)}
      </div>
    );
  };

  return (
    <Container>
      <Header>
        <Avatar src={selectedUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.name}`} alt={selectedUser.name} />
        <UserInfo>
          <UserName>{selectedUser.name}</UserName>
          <UserStatus>{selectedUser.online ? '在线' : '离线'}</UserStatus>
        </UserInfo>
      </Header>
      
      <MessagesContainer>
        {messages.map((message) => (
          <Message key={message.id} isOwn={message.me}>
            <MessageContent isOwn={message.me}>
              {renderMessage(message)}
            </MessageContent>
          </Message>
        ))}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <InputContainer>
        <InputWrapper>
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            rows={1}
          />
          <ButtonGroup>
            <IconButton onClick={() => fileInputRef.current?.click()}>
              <FiPaperclip size={18} />
            </IconButton>

            {/* 从服务器选择音频 */}
            <IconButton onClick={() => setShowServerPicker(true)} title="从服务器选择音频">
              📂
            </IconButton>
            
            {/* 音频消息选择器按钮 */}
            <IconButton 
              onClick={() => setShowAudioSelector(!showAudioSelector)}
              style={{ 
                background: showAudioSelector ? '#007AFF' : '#f0f0f0',
                color: showAudioSelector ? 'white' : '#666'
              }}
            >
              🎵
            </IconButton>
            
            {isRecording ? (
              <VoiceRecorder
                onStop={handleVoiceRecord}
                onCancel={() => setIsRecording(false)}
              />
            ) : (
              <IconButton onClick={() => setIsRecording(true)}>
                <FiMic size={18} />
              </IconButton>
            )}
            
            <SendButton onClick={handleSend} disabled={!inputText.trim()}>
              <FiSend size={18} />
            </SendButton>
          </ButtonGroup>
        </InputWrapper>

        {/* 音频消息选择器 */}
        {showAudioSelector && (
          <AudioSelectorContainer>
            <AudioSelectorHeader>
              <span>选择 {selectedUser.name} 发送给我们的音频消息</span>
              <IconButton 
                onClick={() => setShowAudioSelector(false)}
                style={{ background: 'none', color: '#666' }}
              >
                ✕
              </IconButton>
            </AudioSelectorHeader>
            <AudioSelectorList>
              {availableAudioMessages.length > 0 ? (
                availableAudioMessages.map((audioMessage) => (
                  <AudioSelectorItem 
                    key={audioMessage.id}
                    onClick={() => handleAudioMessageSelect(audioMessage)}
                  >
                    <AudioSelectorInfo>
                      <AudioSelectorTitle>
                        {audioMessage.audioMetadata?.sender || '未知发送人'}
                      </AudioSelectorTitle>
                      <AudioSelectorSummary>
                        {audioMessage.summary?.summary || '暂无摘要'}
                      </AudioSelectorSummary>
                      <AudioSelectorDuration>
                        时长: {audioMessage.audioMetadata?.audio_duration_sec?.toFixed(1) || 0}秒
                      </AudioSelectorDuration>
                    </AudioSelectorInfo>
                    <AudioSelectorButton>
                      添加到聊天
                    </AudioSelectorButton>
                  </AudioSelectorItem>
                ))
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#666',
                  fontSize: '14px'
                }}>
                  {availableAudioMessages === null ? '正在加载音频消息...' : '暂无可用的音频消息'}
                </div>
              )}
            </AudioSelectorList>
          </AudioSelectorContainer>
        )}
      </InputContainer>
      
      <FileInput
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac,video/*,*/*"
      />
      
      {/* 上传进度显示 */}
      {isUploadingAudio && (
        <UploadProgressContainer>
          <UploadText>正在处理音频文件...</UploadText>
          <UploadProgressBar>
            <UploadProgressFill progress={uploadProgress} />
          </UploadProgressBar>
          <UploadText>{uploadProgress}%</UploadText>
          <UploadCancelButton onClick={() => {
            setIsUploadingAudio(false);
            setUploadProgress(0);
          }}>
            取消
          </UploadCancelButton>
        </UploadProgressContainer>
      )}

      {/* 服务器音频选择器 Modal */}
      {showServerPicker && (
        <div style={{
          position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ position: 'relative', width: '80%', maxWidth: 900, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <ServerAudioPicker onResult={handleServerAudioPicked} onClose={() => setShowServerPicker(false)} />
          </div>
        </div>
      )}
    </Container>
  );
};

// 段音频播放器组件（用于播放123报数等短音频）
const SegmentAudioPlayer = ({ message, isOwn, onPlay, onPause, isPlaying, socket }) => {
  const [isSegmentPlaying, setIsSegmentPlaying] = useState(false);
  
  // 段音频播放状态管理
  useEffect(() => {
    // 确保全局只有一个段音频在播放
    if (isPlaying && message.id) {
      // 设置段音频播放状态
      window.currentPlayingSegmentAudio = {
        messageId: message.id,
        timestamp: Date.now()
      };
      setIsSegmentPlaying(true);
    } else {
      // 清除段音频播放状态
      if (window.currentPlayingSegmentAudio && window.currentPlayingSegmentAudio.messageId === message.id) {
        window.currentPlayingSegmentAudio = null;
      }
      setIsSegmentPlaying(false);
    }
    
    return () => {
      // 组件卸载时清理全局状态
      if (window.currentPlayingSegmentAudio && window.currentPlayingSegmentAudio.messageId === message.id) {
        window.currentPlayingSegmentAudio = null;
      }
    };
  }, [isPlaying, message.id]);

  const handleSegmentPlay = () => {
    // 检查是否有其他段音频在播放
    if (window.currentPlayingSegmentAudio && window.currentPlayingSegmentAudio.messageId !== message.id) {
      console.log('检测到其他段音频正在播放，先停止:', window.currentPlayingSegmentAudio.messageId);
      if (socket) {
        socket.emit('stop_other_segment_audio', {
          messageId: window.currentPlayingSegmentAudio.messageId,
          timestamp: Date.now()
        });
      }
    }
    
    // 开始播放当前段音频
    onPlay();
  };

  const handleSegmentPause = () => {
    onPause();
  };

  return (
    <AudioPlayerContainer isOwn={isOwn}>
      <AudioHeader>
        <AudioInfo>
          <AudioTitle>{message.audioMetadata?.sender || message.senderName}</AudioTitle>
          <AudioDuration>段音频</AudioDuration>
        </AudioInfo>
        <PlayButton onClick={isPlaying ? handleSegmentPause : handleSegmentPlay}>
          {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
        </PlayButton>
      </AudioHeader>
      
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', marginBottom: '8px' }}>
          {message.audioMetadata?.overall_summary || message.summary?.summary || '段音频内容'}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.7 }}>
          点击播放按钮开始播报
        </div>
      </div>
    </AudioPlayerContainer>
  );
};

export default Chat; 