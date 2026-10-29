#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频分割和TTS生成脚本
将原始MP3按时间段分割，并生成对应的TTS音频文件
"""

import json
import os
import subprocess
from pathlib import Path
import base64

class AudioSegmentProcessor:
    def __init__(self, audio_dir, results_file, output_dir):
        self.audio_dir = Path(audio_dir)
        self.results_file = Path(results_file)
        self.output_dir = Path(output_dir)
        
        # 创建分类目录
        self.original_segments_dir = self.output_dir / "original_segments"
        self.tts_segments_dir = self.output_dir / "tts_segments"
        self.tts_summary_dir = self.output_dir / "tts_summary"
        
        for dir_path in [self.original_segments_dir, self.tts_segments_dir, self.tts_summary_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # 加载音频数据
        with open(self.results_file, 'r', encoding='utf-8') as f:
            self.audio_data = json.load(f)
    
    def extract_audio_segment(self, input_file, start_time, end_time, output_file):
        """使用ffmpeg提取音频片段"""
        try:
            cmd = [
                'ffmpeg', '-i', str(input_file),
                '-ss', str(start_time),
                '-t', str(end_time - start_time),
                '-c', 'copy',
                '-y', str(output_file)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"提取音频片段失败: {e}")
            return False
    
    def create_text_to_speech(self, text, output_file, voice="zh-CN-XiaoxiaoNeural"):
        """使用edge-tts创建TTS音频"""
        try:
            cmd = [
                'edge-tts',
                '--voice', voice,
                '--text', text,
                '--write-media', str(output_file)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"TTS生成失败: {e}")
            return False
    
    def process_audio_file(self, audio_item):
        """处理单个音频文件"""
        file_id = audio_item['file_id']
        filename = audio_item['filename']
        sender = audio_item['sender']
        overall_summary = audio_item['overall_summary']
        highlights = audio_item['highlights']
        
        input_file = self.audio_dir / filename
        
        if not input_file.exists():
            print(f"音频文件不存在: {input_file}")
            return None
        
        print(f"处理音频文件: {filename}")
        
        # 创建该文件的子目录
        file_original_dir = self.original_segments_dir / file_id
        file_tts_dir = self.tts_segments_dir / file_id
        file_summary_dir = self.tts_summary_dir / file_id
        
        for dir_path in [file_original_dir, file_tts_dir, file_summary_dir]:
            dir_path.mkdir(exist_ok=True)
        
        results = {
            'file_id': file_id,
            'original_file': filename,
            'sender': sender,
            'overall_summary': overall_summary,
            'original_segments': [],
            'tts_segments': [],
            'tts_summary': None
        }
        
        # 1. 生成发送人+总摘要的TTS
        summary_text = f"发送人：{sender}。{overall_summary}"
        summary_file = file_summary_dir / "sender_summary.mp3"
        if self.create_text_to_speech(summary_text, summary_file):
            results['tts_summary'] = str(summary_file)
            print(f"✓ 生成总摘要TTS: {summary_file}")
        else:
            print(f"✗ 总摘要TTS生成失败")
        
        # 2. 分割原语音并生成分摘要TTS
        for i, highlight in enumerate(highlights[:3]):  # 只取前3个分摘要
            segment_num = i + 1
            
            # 提取原语音片段
            original_segment_file = file_original_dir / f"segment_{segment_num}.mp3"
            if self.extract_audio_segment(
                input_file,
                highlight['start_time_sec'],
                highlight['end_time_sec'],
                original_segment_file
            ):
                results['original_segments'].append({
                    'segment_num': segment_num,
                    'file_path': str(original_segment_file),
                    'start_time': highlight['start_time_sec'],
                    'end_time': highlight['end_time_sec'],
                    'duration': highlight['duration_sec'],
                    'summary_text': highlight['summary_text'],
                    'original_text': highlight['original_text']
                })
                print(f"✓ 提取原语音片段 {segment_num}: {original_segment_file}")
            else:
                print(f"✗ 原语音片段 {segment_num} 提取失败")
            
            # 生成分摘要TTS
            tts_text = f"分摘要{segment_num}：{highlight['summary_text']}"
            tts_file = file_tts_dir / f"segment_{segment_num}_summary.mp3"
            if self.create_text_to_speech(tts_text, tts_file):
                results['tts_segments'].append({
                    'segment_num': segment_num,
                    'file_path': str(tts_file),
                    'summary_text': highlight['summary_text']
                })
                print(f"✓ 生成分摘要TTS {segment_num}: {tts_file}")
            else:
                print(f"✗ 分摘要TTS {segment_num} 生成失败")
        
        return results
    
    def process_all_audio_files(self):
        """处理所有音频文件"""
        all_results = []
        
        for audio_item in self.audio_data:
            result = self.process_audio_file(audio_item)
            if result:
                all_results.append(result)
        
        # 保存处理结果
        results_file = self.output_dir / "audio_processing_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n处理完成，共处理 {len(all_results)} 个音频文件")
        print(f"结果保存到: {results_file}")
        print(f"文件结构:")
        print(f"  {self.output_dir}/")
        print(f"  ├── original_segments/     # 原语音片段")
        print(f"  ├── tts_segments/          # 分摘要TTS")
        print(f"  ├── tts_summary/           # 总摘要TTS")
        print(f"  └── audio_processing_results.json")
        
        return all_results
    
    def generate_file_list(self):
        """生成文件列表"""
        results_file = self.output_dir / "audio_processing_results.json"
        
        if not results_file.exists():
            print("请先运行process_all_audio_files()")
            return
        
        with open(results_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        file_list = []
        
        for result in results:
            file_id = result['file_id']
            
            # 添加总摘要TTS
            if result['tts_summary']:
                file_list.append({
                    'type': 'summary_tts',
                    'file_id': file_id,
                    'file_path': result['tts_summary'],
                    'description': f"{result['sender']} - 总摘要"
                })
            
            # 添加原语音片段
            for segment in result['original_segments']:
                file_list.append({
                    'type': 'original_segment',
                    'file_id': file_id,
                    'segment_num': segment['segment_num'],
                    'file_path': segment['file_path'],
                    'description': f"{result['sender']} - 原语音片段{segment['segment_num']} ({segment['duration']:.1f}s)"
                })
            
            # 添加分摘要TTS
            for segment in result['tts_segments']:
                file_list.append({
                    'type': 'segment_tts',
                    'file_id': file_id,
                    'segment_num': segment['segment_num'],
                    'file_path': segment['file_path'],
                    'description': f"{result['sender']} - 分摘要{segment['segment_num']} TTS"
                })
        
        # 保存文件列表
        file_list_path = self.output_dir / "file_list.json"
        with open(file_list_path, 'w', encoding='utf-8') as f:
            json.dump(file_list, f, ensure_ascii=False, indent=2)
        
        print(f"文件列表已生成: {file_list_path}")
        return file_list

def main():
    # 配置路径 - 修复路径层级
    audio_dir = "../study1/study1语音+摘要"
    results_file = "../study1/study1语音+摘要/results.json"
    output_dir = "data"
    
    # 创建处理器
    processor = AudioSegmentProcessor(audio_dir, results_file, output_dir)
    
    # 处理所有音频文件
    print("开始处理音频文件...")
    results = processor.process_all_audio_files()
    
    # 生成文件列表
    print("\n生成文件列表...")
    file_list = processor.generate_file_list()
    
    print("\n处理完成！")
    print(f"所有文件已分类存储在: {output_dir}")

if __name__ == "__main__":
    main() 