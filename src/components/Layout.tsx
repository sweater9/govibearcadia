import { Gamepad2, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
export function Layout({children}:{children:ReactNode}){
 const [online,setOnline]=useState(navigator.onLine)
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);addEventListener('online',update);addEventListener('offline',update);return()=>{removeEventListener('online',update);removeEventListener('offline',update)}},[])
 return <div className="min-h-screen"><header className="nav"><Link to="/" className="brand"><span className="brand-mark"><Gamepad2 size={20}/></span><span>GoVibe<span className="text-cyan">Arcadia</span></span></Link><nav><Link to="/">Discover</Link><a href="/#library">Library</a></nav><div className="status">{online?<><span className="status-dot"/>Online</>:<><WifiOff size={14}/>Offline ready</>}</div></header>{children}<footer><div className="brand justify-center"><span className="brand-mark"><Gamepad2 size={18}/></span>GoVibeArcadia</div><p>Play instantly. Explore endlessly. Your progress stays on your device.</p></footer></div>
}
