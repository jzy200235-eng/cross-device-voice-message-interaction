const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 添加fetch支持（Node.js 18+内置，或使用node-fetch）
let fetch;
try {
    fetch = globalThis.fetch;
} catch (e) {
    try {
        fetch = require('node-fetch');
    } catch (e2) {
        console.warn('未找到fetch实现，高级处理功能将不可用');
        fetch = null;
    }
}

class SummarizationService {
    constructor() {
        this.whisperModel = 'base'; // 使用base模型，更快
        this.openaiApiKey = process.env.OPENAI_API_KEY || '';
        this.openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        
        // 新增：改为直接调用本地 Python 管道脚本
        this.pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5001'; // 兼容旧配置，不再使用
        this.useAdvancedProcessing = process.env.USE_ADVANCED_PROCESSING !== 'false';
        this.voiceProjectDir = path.resolve(__dirname, '../../Voice_Summary_Project');
        
        // 添加缓存机制
        this.processedCache = new Map(); // 缓存已处理的文件
    }

    // 语音转文本
    async speechToText(audioBuffer) {
        try {
            // 保存音频文件
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);
            fs.writeFileSync(audioPath, audioBuffer);

            // 使用whisper进行语音识别
            const transcript = await this.runWhisper(audioPath);
            
            // 清理临时文件
            fs.unlinkSync(audioPath);

            return transcript;
        } catch (error) {
            console.error('语音转文本失败:', error);
            throw error;
        }
    }

    // 处理服务器上的音频文件（直接传文件路径给 Python 的 segment_pipeline）
    async processVoiceFile(absoluteFilePath) {
        try {
            if (!absoluteFilePath || !fs.existsSync(absoluteFilePath)) {
                throw new Error('音频文件不存在');
            }

            // 检查缓存
            const stats = fs.statSync(absoluteFilePath);
            const cacheKey = `${absoluteFilePath}_${stats.mtime.getTime()}`;
            
            if (this.processedCache.has(cacheKey)) {
                console.log('使用缓存结果:', cacheKey);
                return this.processedCache.get(cacheKey);
            }

            console.log('开始处理音频文件:', absoluteFilePath);
            
            return new Promise((resolve, reject) => {
                const args = ['segment_pipeline.py', '--audio_path', absoluteFilePath, '--compact'];
                const py = spawn('python', args, {
                    cwd: this.voiceProjectDir,
                    env: {
                        ...process.env,
                        PYTHONIOENCODING: 'utf-8',
                        PYTHONUTF8: '1'
                    }
                });

                let stdout = '';
                let stderr = '';
                py.stdout.on('data', d => { 
                    const chunk = d.toString('utf8');
                    stdout += chunk;
                    console.log('Python stdout chunk:', chunk.substring(0, 100));
                });
                py.stderr.on('data', d => { 
                    const chunk = d.toString('utf8');
                    stderr += chunk;
                    console.log('Python stderr chunk:', chunk.substring(0, 100));
                });
                py.on('close', (code) => {
                    console.log('Python进程结束:', { code, stdoutLength: stdout.length, stderrLength: stderr.length });
                    if (code !== 0) {
                        console.error('Python进程错误:', { code, stderr, stdout });
                        return reject(new Error(`Python处理失败 (退出码${code}): ${stderr || '未知错误'}`));
                    }
                    try {
                        // 优先从stderr读取JSON（避免代理错误干扰）
                        let jsonOutput = stderr.trim();
                        if (!jsonOutput) {
                            // 如果stderr为空，回退到stdout
                            jsonOutput = stdout.trim();
                        } else if (stdout.trim()) {
                            // 如果stderr和stdout都有内容，检查哪个包含有效JSON
                            const stderrHasJson = stderr.includes('{') && stderr.includes('}');
                            const stdoutHasJson = stdout.includes('{') && stdout.includes('}');
                            
                            if (!stderrHasJson && stdoutHasJson) {
                                console.log('stderr无JSON，使用stdout');
                                jsonOutput = stdout.trim();
                            } else if (stderrHasJson) {
                                console.log('使用stderr中的JSON');
                            }
                        }
                        
                        if (!jsonOutput) {
                            return reject(new Error('Python未返回任何输出'));
                        }
                        
                        console.log('Python JSON输出:', jsonOutput.substring(0, 500));
                        
                        // 更健壮的JSON提取逻辑
                        let jsonStr = '';
                        
                        // 方法1: 查找最后一个完整的JSON对象
                        const lines = jsonOutput.split('\n');
                        for (let i = lines.length - 1; i >= 0; i--) {
                            const line = lines[i].trim();
                            if (line.startsWith('{') && line.includes('"')) {
                                // 找到可能的JSON开始，尝试提取完整JSON
                                const startIndex = jsonOutput.lastIndexOf(line);
                                const remainingText = jsonOutput.substring(startIndex);
                                
                                // 尝试找到JSON结束位置
                                let braceCount = 0;
                                let jsonEnd = -1;
                                for (let j = 0; j < remainingText.length; j++) {
                                    if (remainingText[j] === '{') braceCount++;
                                    if (remainingText[j] === '}') braceCount--;
                                    if (braceCount === 0) {
                                        jsonEnd = j + 1;
                                        break;
                                    }
                                }
                                
                                if (jsonEnd > 0) {
                                    jsonStr = remainingText.substring(0, jsonEnd);
                                    break;
                                }
                            }
                        }
                        
                        // 方法2: 如果方法1失败，尝试正则表达式匹配
                        if (!jsonStr) {
                            const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                jsonStr = jsonMatch[0];
                            }
                        }
                        
                        // 方法3: 如果还是失败，尝试查找第一个{到最后一个}
                        if (!jsonStr) {
                            const firstBrace = jsonOutput.indexOf('{');
                            const lastBrace = jsonOutput.lastIndexOf('}');
                            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                                jsonStr = jsonOutput.substring(firstBrace, lastBrace + 1);
                            }
                        }
                        
                        if (!jsonStr) {
                            return reject(new Error(`无法提取有效JSON: ${jsonOutput.substring(0, 200)}`));
                        }
                        
                        console.log('提取的JSON字符串:', jsonStr.substring(0, 200));
                        
                        const parsed = JSON.parse(jsonStr);
                        
                        // 检查是否有错误
                        if (parsed.error) {
                            return reject(new Error(parsed.error));
                        }
                        
                        // 规范化为前端需要的结构
                        const normalized = {
                            success: true,
                            transcript: parsed.transcript || parsed.full_text || '',
                            summary: parsed.summary || parsed.overall_summary || '',
                            timestamp: parsed.timestamp || new Date().toISOString(),
                            msg_type: parsed.msg_type || 'task',
                            emotion: parsed.emotion || '中性',
                            segments: parsed.segments || [],
                            transcript_clean: parsed.transcript_clean || '',
                            audio_duration_sec: parsed.audio_duration_sec || 0
                        };
                        
                        // 缓存结果
                        this.processedCache.set(cacheKey, normalized);
                        console.log('处理完成并缓存:', cacheKey);
                        
                        resolve(normalized);
                    } catch (e) {
                        console.error('JSON解析错误:', { stdout, stderr, error: e.message });
                        reject(new Error(`解析Python输出失败: ${e.message}. 输出: ${stdout.substring(0, 200)}`));
                    }
                });
                
                // 设置超时
                setTimeout(() => {
                    py.kill();
                    reject(new Error('Python处理超时'));
                }, 120000); // 2分钟超时
                
            });
        } catch (err) {
            throw err;
        }
    }

    // 运行Whisper模型
    async runWhisper(audioPath) {
        return new Promise((resolve, reject) => {
            const pythonScript = `
import whisper
import sys
import json

def transcribe_audio(audio_path):
    try:
        model = whisper.load_model("${this.whisperModel}")
        result = model.transcribe(audio_path, language="zh")
        return json.dumps({
            "success": True,
            "text": result["text"],
            "segments": result["segments"]
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })

if __name__ == "__main__":
    audio_path = sys.argv[1]
    result = transcribe_audio(audio_path)
    print(result)
            `;

            const pythonFile = path.join(__dirname, 'temp', 'whisper_script.py');
            fs.writeFileSync(pythonFile, pythonScript);

            const pythonProcess = spawn('python', [pythonFile, audioPath]);
            
            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                try {
                    fs.unlinkSync(pythonFile);
                    
                    if (code !== 0) {
                        reject(new Error(`Whisper执行失败: ${errorOutput}`));
                        return;
                    }

                    const result = JSON.parse(output);
                    if (result.success) {
                        resolve(result.text);
                    } else {
                        reject(new Error(result.error));
                    }
                } catch (error) {
                    reject(new Error(`解析Whisper结果失败: ${error.message}`));
                }
            });
        });
    }

    // 生成摘要（降级：直接用开放模型）
    async generateSummary(text) {
        try {
            const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个专业的语音摘要助手。请对用户提供的语音转文本内容进行简洁的摘要，控制在40字以内。'
                        },
                        {
                            role: 'user',
                            content: `请对以下语音内容进行摘要：\n\n${text}`
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('生成摘要失败:', error);
            throw error;
        }
    }

    // 处理语音消息并生成摘要
    async processVoiceMessage(audioBuffer) {
        try {
            // 优先使用高级处理（本地 Python 管道）
            if (this.useAdvancedProcessing) {
                try {
                    const advancedResult = await this.processVoiceMessageAdvanced(audioBuffer);
                    if (advancedResult.success) {
                        return advancedResult;
                    }
                    console.warn('高级处理失败，降级到简单处理:', advancedResult.error);
                } catch (error) {
                    console.warn('高级处理异常，降级到简单处理:', error.message);
                }
            }

            // 降级到简单处理
            return await this.processVoiceMessageSimple(audioBuffer);
            
        } catch (error) {
            console.error('处理语音消息失败:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 高级语音处理（本地运行 run_pipeline.py：音频→转写→文本管道）
    async processVoiceMessageAdvanced(audioBuffer) {
        try {
            console.log('使用高级语音处理（本地Python管道）...');

            // 1) 语音转文本（Node本地 Whisper 或其他）
            const transcript = await this.speechToText(audioBuffer);
            if (!transcript || transcript.trim().length === 0) {
                throw new Error('语音转文本失败或内容为空');
            }

            // 2) 调用文本管道
            const pipeResult = await this.runTextPipelineViaPython(transcript);
            return {
                success: true,
                transcript: pipeResult.transcript || transcript,
                summary: pipeResult.summary || pipeResult.final_summary || '',
                timestamp: new Date().toISOString(),
                msg_type: pipeResult.predicted_type || pipeResult.msg_type || 'task',
                emotion: pipeResult.emotion || '中性',
                segments: pipeResult.segments || [],
                transcript_clean: pipeResult.transcript_clean || ''
            };
        } catch (error) {
            console.error('高级语音处理失败:', error);
            throw error;
        }
    }

    // 简单语音处理（原有逻辑）
    async processVoiceMessageSimple(audioBuffer) {
        try {
            // 1. 语音转文本
            const transcript = await this.speechToText(audioBuffer);
            
            if (!transcript || transcript.trim().length === 0) {
                throw new Error('语音转文本失败或内容为空');
            }

            // 2. 生成摘要
            const summary = await this.generateSummary(transcript);

            return {
                success: true,
                transcript: transcript,
                summary: summary,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('简单语音处理失败:', error);
            throw error;
        }
    }

    // 处理文本消息并生成摘要
    async processTextMessage(text) {
        try {
            // 优先使用高级处理（Python API）
            if (this.useAdvancedProcessing) {
                try {
                    const advancedResult = await this.processTextMessageAdvanced(text);
                    if (advancedResult.success) {
                        return advancedResult;
                    }
                    console.warn('高级文本处理失败，降级到简单处理:', advancedResult.error);
                } catch (error) {
                    console.warn('高级文本处理异常，降级到简单处理:', error.message);
                }
            }

            // 降级到简单处理
            return await this.processTextMessageSimple(text);
            
        } catch (error) {
            console.error('处理文本消息失败:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 高级文本处理（本地运行 run_pipeline.py）
    async processTextMessageAdvanced(text) {
        try {
            console.log('使用高级文本处理（本地Python管道）...');
            const result = await this.runTextPipelineViaPython(text);
            return {
                success: true,
                originalText: text,
                summary: result.summary || result.final_summary || '',
                timestamp: new Date().toISOString(),
                msg_type: result.predicted_type || result.msg_type || 'task',
                emotion: result.emotion || '中性',
                transcript_clean: result.transcript_clean || ''
            };
        } catch (error) {
            console.error('高级文本处理失败:', error);
            throw error;
        }
    }

    // 简单文本处理（原有逻辑）
    async processTextMessageSimple(text) {
        try {
            const summary = await this.generateSummary(text);
            
            return {
                success: true,
                originalText: text,
                summary: summary,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('简单文本处理失败:', error);
            throw error;
        }
    }

    // 通过运行 Voice_Summary_Project/run_pipeline.py 的文本管道
    async runTextPipelineViaPython(text) {
        return new Promise((resolve, reject) => {
            try {
                const pythonCode = `
import json, sys
sys.path.append('.')
from run_pipeline import run_text_pipeline, load_classifier_model, load_summarizer_models

try:
    classifier_models = load_classifier_model()
    summarizer_models = load_summarizer_models()
    text = sys.stdin.read()
    result = run_text_pipeline(text, classifier_models, summarizer_models)
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const scriptPath = path.join(tempDir, `pipe_${Date.now()}.py`);
                fs.writeFileSync(scriptPath, pythonCode, 'utf8');

                const py = spawn('python', [scriptPath], {
                    cwd: this.voiceProjectDir,
                    env: process.env
                });

                let stdout = '';
                let stderr = '';
                py.stdout.on('data', d => { stdout += d.toString(); });
                py.stderr.on('data', d => { stderr += d.toString(); });
                py.on('close', (code) => {
                    try { fs.unlinkSync(scriptPath); } catch {}
                    if (code !== 0 && !stdout) {
                        return reject(new Error(`Python 退出码 ${code}: ${stderr}`));
                    }
                    try {
                        const jsonStart = stdout.lastIndexOf('{');
                        const payload = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
                        const parsed = JSON.parse(payload);
                        if (parsed && !parsed.error) return resolve(parsed);
                        return reject(new Error(parsed.error || '未知Python错误'));
                    } catch (e) {
                        return reject(new Error(`解析Python输出失败: ${e.message}. 输出: ${stdout}`));
                    }
                });

                // 将文本写入stdin
                py.stdin.write(text);
                py.stdin.end();
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = SummarizationService; 