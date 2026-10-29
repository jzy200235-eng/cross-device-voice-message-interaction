#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化的音频处理脚本
将MP3文件按照摘要时间段分割并重新组合成四个部分的音频
不依赖TTS服务，直接使用原音频
"""

import json
import os
import subprocess
from pathlib import Path
import base64

class SimpleAudioProcessor:
    def __init__(self, audio_dir, results_file, output_dir):
        self.audio_dir = Path(audio_dir)
        self.results_file = Path(results_file)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
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
    
    def concatenate_audio_files(self, input_files, output_file):
        """使用ffmpeg连接音频文件"""
        try:
            # 创建文件列表
            list_file = self.output_dir / "concat_list.txt"
            with open(list_file, 'w', encoding='utf-8') as f:
                for file_path in input_files:
                    f.write(f"file '{file_path}'\n")
            
            cmd = [
                'ffmpeg', '-f', 'concat',
                '-safe', '0',
                '-i', str(list_file),
                '-c', 'copy',
                '-y', str(output_file)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            
            # 清理临时文件
            list_file.unlink()
            return True
        except subprocess.CalledProcessError as e:
            print(f"连接音频文件失败: {e}")
            return False
    
    def create_silence_audio(self, duration, output_file):
        """创建静音音频"""
        try:
            cmd = [
                'ffmpeg', '-f', 'lavfi',
                '-i', f'anullsrc=channel_layout=stereo:sample_rate=44100',
                '-t', str(duration),
                '-y', str(output_file)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"创建静音音频失败: {e}")
            return False
    
    def process_audio_file(self, audio_item):
        """处理单个音频文件，生成四个部分的组合音频"""
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
        
        # 创建临时目录
        temp_dir = self.output_dir / f"temp_{file_id}"
        temp_dir.mkdir(exist_ok=True)
        
        try:
            part_files = []
            
            # Part 1: 发送人+总摘要 (使用原音频的前5秒作为介绍)
            part1_file = temp_dir / "part1_intro.mp3"
            if not self.extract_audio_segment(input_file, 0, 5, part1_file):
                # 如果提取失败，创建静音
                self.create_silence_audio(2, part1_file)
            part_files.append(part1_file)
            
            # Part 2-4: 分摘要+对应的原语音
            for i, highlight in enumerate(highlights[:3]):  # 只取前3个分摘要
                part_num = i + 2
                
                # 提取对应的原语音片段
                original_file = temp_dir / f"part{part_num}_original.mp3"
                if not self.extract_audio_segment(
                    input_file, 
                    highlight['start_time_sec'], 
                    highlight['end_time_sec'], 
                    original_file
                ):
                    print(f"Part {part_num} 原语音提取失败")
                    continue
                
                part_files.append(original_file)
            
            # 连接所有部分
            final_output = self.output_dir / f"{file_id}_combined.mp3"
            if self.concatenate_audio_files(part_files, final_output):
                print(f"成功生成组合音频: {final_output}")
                return final_output
            else:
                print("组合音频生成失败")
                return None
                
        finally:
            # 清理临时文件
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def process_all_audio_files(self):
        """处理所有音频文件"""
        results = []
        
        for audio_item in self.audio_data:
            result = self.process_audio_file(audio_item)
            if result:
                results.append({
                    'file_id': audio_item['file_id'],
                    'original_file': audio_item['filename'],
                    'combined_file': result.name,
                    'sender': audio_item['sender'],
                    'duration': audio_item['audio_duration_sec'],
                    'summary': audio_item['overall_summary'],
                    'highlights': audio_item['highlights']
                })
        
        # 保存处理结果
        results_file = self.output_dir / "processed_audio_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"处理完成，共生成 {len(results)} 个组合音频文件")
        print(f"结果保存到: {results_file}")
        
        return results
    
    def convert_to_base64(self, audio_file):
        """将音频文件转换为base64编码"""
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            return base64.b64encode(audio_data).decode('utf-8')
    
    def generate_web_audio_data(self):
        """生成用于Web应用的音频数据"""
        results_file = self.output_dir / "processed_audio_results.json"
        
        if not results_file.exists():
            print("请先运行process_all_audio_files()")
            return
        
        with open(results_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        web_data = []
        
        for result in results:
            combined_file = self.output_dir / result['combined_file']
            if combined_file.exists():
                base64_data = self.convert_to_base64(combined_file)
                web_data.append({
                    'file_id': result['file_id'],
                    'audioData': f"data:audio/mp3;base64,{base64_data}",
                    'duration': result['duration'],
                    'filename': result['combined_file'],
                    'sender': result['sender'],
                    'summary': result['summary'],
                    'highlights': result['highlights']
                })
        
        # 保存Web音频数据
        web_data_file = self.output_dir / "web_audio_data.json"
        with open(web_data_file, 'w', encoding='utf-8') as f:
            json.dump(web_data, f, ensure_ascii=False, indent=2)
        
        print(f"Web音频数据已生成: {web_data_file}")
        return web_data

def main():
    # 配置路径
    audio_dir = "study1/study1语音+摘要"
    results_file = "study1/study1语音+摘要/results.json"
    output_dir = "web-chat-app/processed_audio"
    
    # 创建处理器
    processor = SimpleAudioProcessor(audio_dir, results_file, output_dir)
    
    # 处理所有音频文件
    print("开始处理音频文件...")
    results = processor.process_all_audio_files()
    
    # 生成Web音频数据
    print("生成Web音频数据...")
    web_data = processor.generate_web_audio_data()
    
    print("处理完成！")

if __name__ == "__main__":
    main() 