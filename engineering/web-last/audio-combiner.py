#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频组合脚本
将TTS和原语音片段按照四个部分组合，并标注分割位置
"""

import json
import os
import subprocess
from pathlib import Path
import base64

class AudioCombiner:
    def __init__(self, data_dir, output_dir):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # 加载处理结果
        results_file = self.data_dir / "audio_processing_results.json"
        with open(results_file, 'r', encoding='utf-8') as f:
            self.audio_data = json.load(f)
    
    def get_audio_duration(self, audio_file):
        """获取音频文件时长"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                '-of', 'csv=p=0', str(audio_file)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            duration = float(result.stdout.strip())
            print(f"  获取音频时长: {audio_file.name} -> {duration:.1f}s")
            return duration
        except subprocess.CalledProcessError as e:
            print(f"无法获取音频时长: {audio_file} - 错误: {e}")
            print(f"ffprobe输出: {e.stderr}")
            return 0
        except ValueError as e:
            print(f"音频时长解析失败: {audio_file} - 错误: {e}")
            return 0
    
    def concatenate_audio_files(self, input_files, output_file):
        """使用ffmpeg连接音频文件"""
        try:
            # 创建文件列表
            list_file = self.output_dir / "concat_list.txt"
            with open(list_file, 'w', encoding='utf-8') as f:
                for file_path in input_files:
                    # 使用绝对路径
                    abs_path = Path(file_path).resolve()
                    f.write(f"file '{abs_path}'\n")
            
            # 使用重新编码而不是直接复制，确保格式兼容
            cmd = [
                'ffmpeg', '-f', 'concat',
                '-safe', '0',
                '-i', str(list_file),
                '-c:a', 'mp3',  # 重新编码为MP3
                '-b:a', '128k',  # 设置比特率
                '-y', str(output_file)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"ffmpeg错误输出: {result.stderr}")
                return False
            
            # 清理临时文件
            list_file.unlink()
            return True
        except subprocess.CalledProcessError as e:
            print(f"连接音频文件失败: {e}")
            print(f"错误输出: {e.stderr if hasattr(e, 'stderr') else '未知错误'}")
            return False
        except Exception as e:
            print(f"连接音频文件时发生异常: {e}")
            return False
    
    def combine_audio_file(self, audio_item):
        """组合单个音频文件的四个部分"""
        file_id = audio_item['file_id']
        sender = audio_item['sender']
        overall_summary = audio_item['overall_summary']
        original_segments = audio_item['original_segments']
        tts_segments = audio_item['tts_segments']
        tts_summary = audio_item['tts_summary']
        
        print(f"组合音频文件: {file_id}")
        
        # 创建该文件的输出目录
        file_output_dir = self.output_dir / file_id
        file_output_dir.mkdir(exist_ok=True)
        
        # 准备四个部分的音频文件
        part_files = []
        segment_info = []
        current_time = 0
        
        # Part 1: 发送人+总摘要
        if tts_summary and Path(tts_summary).exists():
            part1_file = Path(tts_summary)
            print(f"  检查文件: {part1_file} - 存在: {part1_file.exists()}")
            part1_duration = self.get_audio_duration(part1_file)
            if part1_duration > 0:
                part_files.append(str(part1_file))
                
                segment_info.append({
                    'part': 1,
                    'type': 'summary',
                    'start_time': current_time,
                    'end_time': current_time + part1_duration,
                    'duration': part1_duration,
                    'description': f"发送人：{sender}。{overall_summary}",
                    'file_path': str(part1_file)
                })
                current_time += part1_duration
                print(f"✓ Part 1: 总摘要 ({part1_duration:.1f}s)")
            else:
                print(f"✗ Part 1: 总摘要TTS时长获取失败")
        else:
            print(f"✗ Part 1: 总摘要TTS文件不存在: {tts_summary}")
        
        # Part 2-4: 分摘要+对应的原语音
        for i in range(min(3, len(original_segments), len(tts_segments))):
            part_num = i + 2
            original_segment = original_segments[i]
            tts_segment = tts_segments[i]
            
            # 分摘要TTS
            tts_file = Path(tts_segment['file_path'])
            if tts_file.exists():
                print(f"  检查文件: {tts_file} - 存在: {tts_file.exists()}")
                tts_duration = self.get_audio_duration(tts_file)
                if tts_duration > 0:
                    part_files.append(str(tts_file))
                    
                    segment_info.append({
                        'part': part_num,
                        'type': 'summary_tts',
                        'start_time': current_time,
                        'end_time': current_time + tts_duration,
                        'duration': tts_duration,
                        'description': f"分摘要{part_num}：{tts_segment['summary_text']}",
                        'file_path': str(tts_file)
                    })
                    current_time += tts_duration
                    print(f"✓ Part {part_num}: 分摘要TTS ({tts_duration:.1f}s)")
                else:
                    print(f"✗ Part {part_num}: 分摘要TTS时长获取失败")
            else:
                print(f"✗ Part {part_num}: 分摘要TTS文件不存在: {tts_file}")
            
            # 原语音片段
            original_file = Path(original_segment['file_path'])
            if original_file.exists():
                print(f"  检查文件: {original_file} - 存在: {original_file.exists()}")
                original_duration = self.get_audio_duration(original_file)
                if original_duration > 0:
                    part_files.append(str(original_file))
                    
                    segment_info.append({
                        'part': part_num,
                        'type': 'original_audio',
                        'start_time': current_time,
                        'end_time': current_time + original_duration,
                        'duration': original_duration,
                        'description': f"原语音片段{part_num}：{original_segment['original_text']}",
                        'file_path': str(original_file),
                        'original_start': original_segment['start_time'],
                        'original_end': original_segment['end_time']
                    })
                    current_time += original_duration
                    print(f"✓ Part {part_num}: 原语音 ({original_duration:.1f}s)")
                else:
                    print(f"✗ Part {part_num}: 原语音时长获取失败")
            else:
                print(f"✗ Part {part_num}: 原语音文件不存在: {original_file}")
        
        # 检查是否有有效的音频文件
        if not part_files:
            print(f"✗ 没有有效的音频文件可以组合: {file_id}")
            return None
        
        print(f"  准备组合 {len(part_files)} 个音频文件...")
        for i, file_path in enumerate(part_files):
            print(f"    {i+1}. {Path(file_path).name}")
        
        # 组合所有部分
        combined_file = file_output_dir / f"{file_id}_combined.mp3"
        if self.concatenate_audio_files(part_files, combined_file):
            print(f"✓ 成功生成组合音频: {combined_file}")
            
            # 保存分割信息
            segment_info_file = file_output_dir / f"{file_id}_segments.json"
            with open(segment_info_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'file_id': file_id,
                    'sender': sender,
                    'overall_summary': overall_summary,
                    'total_duration': current_time,
                    'combined_file': str(combined_file),
                    'segments': segment_info
                }, f, ensure_ascii=False, indent=2)
            
            print(f"✓ 分割信息已保存: {segment_info_file}")
            
            return {
                'file_id': file_id,
                'combined_file': str(combined_file),
                'segments_file': str(segment_info_file),
                'total_duration': current_time,
                'segments': segment_info
            }
        else:
            print(f"✗ 组合音频生成失败: {file_id}")
            return None
    
    def combine_all_audio_files(self):
        """组合所有音频文件"""
        all_results = []
        
        for audio_item in self.audio_data:
            result = self.combine_audio_file(audio_item)
            if result:
                all_results.append(result)
        
        # 保存总体结果
        results_file = self.output_dir / "combined_audio_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n组合完成，共生成 {len(all_results)} 个组合音频文件")
        print(f"结果保存到: {results_file}")
        
        return all_results
    
    def generate_web_audio_data(self):
        """生成用于Web应用的音频数据"""
        results_file = self.output_dir / "combined_audio_results.json"
        
        if not results_file.exists():
            print("请先运行combine_all_audio_files()")
            return
        
        with open(results_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        web_data = []
        
        for result in results:
            combined_file = Path(result['combined_file'])
            if combined_file.exists():
                base64_data = self.convert_to_base64(combined_file)
                web_data.append({
                    'file_id': result['file_id'],
                    'audioData': f"data:audio/mp3;base64,{base64_data}",
                    'duration': result['total_duration'],
                    'filename': combined_file.name,
                    'segments': result['segments']
                })
        
        # 保存Web音频数据
        web_data_file = self.output_dir / "web_combined_audio_data.json"
        with open(web_data_file, 'w', encoding='utf-8') as f:
            json.dump(web_data, f, ensure_ascii=False, indent=2)
        
        print(f"Web音频数据已生成: {web_data_file}")
        return web_data
    
    def convert_to_base64(self, audio_file):
        """将音频文件转换为base64编码"""
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
            return base64.b64encode(audio_data).decode('utf-8')
    
    def print_segment_info(self, file_id):
        """打印指定文件的分割信息"""
        segments_file = self.output_dir / file_id / f"{file_id}_segments.json"
        
        if not segments_file.exists():
            print(f"分割信息文件不存在: {segments_file}")
            return
        
        with open(segments_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n=== {file_id} 分割信息 ===")
        print(f"发送人: {data['sender']}")
        print(f"总摘要: {data['overall_summary']}")
        print(f"总时长: {data['total_duration']:.1f}秒")
        print(f"组合文件: {data['combined_file']}")
        print("\n分割详情:")
        
        for segment in data['segments']:
            print(f"  [{segment['start_time']:.1f}s - {segment['end_time']:.1f}s] "
                  f"Part {segment['part']} ({segment['type']}): {segment['description']}")

def main():
    # 配置路径
    data_dir = "data"
    output_dir = "combined_audio"
    
    # 创建组合器
    combiner = AudioCombiner(data_dir, output_dir)
    
    # 组合所有音频文件
    print("开始组合音频文件...")
    results = combiner.combine_all_audio_files()
    
    # 生成Web音频数据
    print("\n生成Web音频数据...")
    web_data = combiner.generate_web_audio_data()
    
    # 打印第一个文件的分割信息作为示例
    if results:
        combiner.print_segment_info(results[0]['file_id'])
    
    print("\n组合完成！")
    print(f"所有组合音频已存储在: {output_dir}")

if __name__ == "__main__":
    main() 