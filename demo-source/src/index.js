import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import Player from './components/OriginalPlayer';
import message from './fixture.json';
import './review.css';
function Demo(){
const audio=useRef(null),[time,setTime]=useState(0),[playing,setPlaying]=useState(false),[mode,setMode]=useState('equal'),[policy,setPolicy]=useState('snap'),[error,setError]=useState(''),[study,setStudy]=useState(false);
const duration=message.audioMetadata.audio_duration_sec;
const play=()=>{audio.current.play().then(()=>setPlaying(true)).catch(()=>setError('浏览器暂未允许播放，请再次点击播放。'));};
const pause=()=>{audio.current.pause();setPlaying(false);};
const seek=t=>{audio.current.currentTime=t;setTime(t);};
return <><header><a href="../">← 返回项目</a><span>LOCAL REVIEW / 原型 1.0</span></header><main><h1>耳机触摸导航的手机参照界面</h1><p className="intro">核心创新是耳机／戒指上的硬件电容触摸导航，手机界面用于可视参照、统一播放和可用性测试。下方沿用1.0播放器；默认等分映射＋最后经过节点吸附，为最终硬件方案。未连接硬件或在线AI。</p><div className="notice">演示消息与语音均为另制的合成示例，不含参与者录音。1为总摘要，2–4为三个重点。鼠标路径移植了硬件松手判定供参照；不等同于真实佩戴、触摸与反馈。</div><ol className="steps"><li>点击右侧播放键</li><li>选择底部节点3，查看重点二</li><li>拖动经过一个节点后稍微回退，再松手，观察吸附</li></ol><audio ref={audio} src="synthetic-message.wav?review=2" onTimeUpdate={()=>setTime(audio.current.currentTime)} onEnded={()=>setPlaying(false)}/><div className="test"><strong>最终采用：等分映射＋最后经过节点吸附</strong><p>无极／等分／非等分，以及吸附／区间，原本用于可用性测试比较。它们不是五个并列的最终用户功能。</p><label><input type="checkbox" checked={study} onChange={e=>{setStudy(e.target.checked);if(!e.target.checked){setMode('equal');setPolicy('snap');}}}/> 展开可用性测试条件（研究对照）</label></div><div className="status" aria-live="polite">{playing?'正在播放':'已暂停'} · {time.toFixed(1)} / {duration.toFixed(1)} 秒 · {mode==='equal'?'等分':mode==='continuous'?'连续':'按时长比例'} · {policy==='snap'?'吸附':'区间'}判定</div>{error&&<p>{error}</p>}<div className="player"><Player showStudyControls={study} message={message} isOwn={false} onPlay={play} onPause={pause} onSeek={seek} isPlaying={playing} currentTime={time} duration={duration} socket={null} slideMode={mode} setSlideMode={setMode} seekPolicy={policy} setSeekPolicy={setPolicy}/></div><p className="foot">“吸附”保留最后经过的节点，而非几何最近点。原工程的该判定在Chat父组件硬件松手分支；本页将其移植至鼠标参照路径。声音提示不等于真实触觉，预置内容不代表实时AI性能。</p></main></>}
createRoot(document.getElementById('root')).render(<Demo/>);
