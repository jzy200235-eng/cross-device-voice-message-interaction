import React, { useEffect, useState } from 'react';

const ROOT_OPTIONS = [
  { key: 'combined_audio', label: 'combined_audio (web-last/combined_audio)' },
  { key: 'data', label: 'data (web-last/data)' },
  { key: 'voice_data', label: 'voice_data (Voice_Summary_Project/data)' }
];

const ServerAudioPicker = ({ onResult, onClose }) => {
  const [root, setRoot] = useState('voice_data');
  const [subdir, setSubdir] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);

  const loadList = async (r = root, s = subdir) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('root', r);
      if (s) params.set('subdir', s);
      const resp = await fetch(`/api/audio-files?${params.toString()}`);
      if (!resp.ok) throw new Error(`加载失败: ${resp.status}`);
      const data = await resp.json();
      setItems(data.items || []);
      setFilteredItems(data.items || []);
      setSearchTerm(''); // 重置搜索
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  const enterDir = (relPath) => {
    const next = subdir ? `${subdir}/${relPath}` : relPath;
    setSubdir(next);
    loadList(root, next);
  };

  const goUp = () => {
    if (!subdir) return;
    const parts = subdir.split('/').filter(Boolean);
    parts.pop();
    const up = parts.join('/');
    setSubdir(up);
    loadList(root, up);
  };

  const processFile = async (relPath) => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      const resp = await fetch('/api/summarize/voice-by-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root, relativePath: relPath })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || `处理失败: ${resp.status}`);
      setResult(data);
      if (onResult && data && data.success) {
        onResult({
          root,
          relativePath: relPath,
          fileName: relPath.split('/').pop(),
          summary: data
        });
        if (onClose) onClose();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>服务器音频选择器</h2>
        {onClose && <button onClick={onClose} style={{ padding: '4px 8px', border: '1px solid #ccc', background: '#f5f5f5', borderRadius: 4 }}>关闭</button>}
      </div>
      
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label>根目录：</label>
        <select value={root} onChange={e => { setRoot(e.target.value); setSubdir(''); }}>
          {ROOT_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <button onClick={() => loadList()}>刷新</button>
        <button onClick={goUp} disabled={!subdir}>上一级</button>
        <span style={{ color: '#666', fontSize: '14px' }}>当前路径：/{subdir || ''}</span>
      </div>

      {/* 搜索框 */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="搜索文件名..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px 12px', 
            border: '1px solid #ddd', 
            borderRadius: 4,
            fontSize: '14px'
          }}
        />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>}
      {error && <div style={{ color: 'red', padding: 8, background: '#ffe6e6', borderRadius: 4, marginBottom: 12 }}>{error}</div>}

      {/* 文件列表 - 可滚动 */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: 4, 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          overflowY: 'auto', 
          flex: 1,
          maxHeight: '400px'
        }}>
          {filteredItems.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
              {searchTerm ? '未找到匹配的文件' : '暂无内容'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filteredItems.map(it => (
                <li key={it.relPath} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '8px 12px', 
                  borderBottom: '1px dashed #eee',
                  backgroundColor: it.isAudio ? '#f9f9f9' : 'transparent'
                }}>
                  <span style={{ width: 20, fontSize: '16px' }}>
                    {it.isDir ? '📁' : (it.isAudio ? '🎵' : '📄')}
                  </span>
                  <span style={{ 
                    flex: 1, 
                    wordBreak: 'break-all', 
                    fontSize: '14px',
                    color: it.isAudio ? '#333' : '#666'
                  }}>
                    {it.name}
                  </span>
                  {it.isDir ? (
                    <button 
                      onClick={() => enterDir(it.name)}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        border: '1px solid #007AFF',
                        background: '#007AFF',
                        color: 'white',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      进入
                    </button>
                  ) : it.isAudio ? (
                    <button 
                      onClick={() => processFile(it.relPath)}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        border: '1px solid #34C759',
                        background: '#34C759',
                        color: 'white',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      处理
                    </button>
                  ) : (
                    <span style={{ color: '#bbb', fontSize: '12px' }}>不支持</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* 统计信息 */}
        <div style={{ 
          padding: '8px 12px', 
          background: '#f5f5f5', 
          borderTop: '1px solid #ddd',
          fontSize: '12px',
          color: '#666'
        }}>
          共 {filteredItems.length} 项
          {searchTerm && ` (从 ${items.length} 项中筛选)`}
        </div>
      </div>

      {result && (
        <div style={{ whiteSpace: 'pre-wrap' }}>
          <h3>处理结果</h3>
          <div><b>类型</b>：{result.msg_type || ''}</div>
          <div><b>情感</b>：{result.emotion || ''}</div>
          <div><b>摘要</b>：{result.summary || ''}</div>
          {Array.isArray(result.segments) && result.segments.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <b>分段摘要</b>
              <ol>
                {result.segments.map((s, idx) => (
                  <li key={idx}>
                    <div style={{ color: '#666' }}>{s.time_range || ''}</div>
                    <div>{s.segment_summary || ''}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerAudioPicker;


