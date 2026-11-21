import { GamepadBridge } from './GamepadBridge'
import { Gamepad2, WifiOff } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getWallet } from '../lib/db'
/** Moves keyboard focus to the page's main content (the skip link), so tabbing does not start in the header again. */
function skipToMain(e: React.MouseEvent<HTMLAnchorElement>) {
 const main = document.querySelector('main')
 if (!main) return
 e.preventDefault()
 if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
 main.focus()
 main.scrollIntoView({ block: 'start' })
}
/** Tells screen readers which page they landed on after a client-side navigation (the tab title is not read by itself). */
function useRouteAnnouncer() {
 const { pathname } = useLocation()
 const [message, setMessage] = useState('')
 const first = useRef(true)
 useEffect(() => {
  if (first.current) { first.current = false; return }
  const timer = setTimeout(() => setMessage(document.title), 150)
  return () => clearTimeout(timer)
 }, [pathname])
 return message
}
export function Layout({children}:{children:ReactNode}){
 const announcement = useRouteAnnouncer()
 const [online,setOnline]=useState(navigator.onLine)
 const [coins,setCoins]=useState<number|null>(null)
 useEffect(()=>{let live=true;const load=()=>void getWallet().then(w=>live&&setCoins(w.coins)).catch(()=>{});load();addEventListener('govibearcadia:wallet',load);return()=>{live=false;removeEventListener('govibearcadia:wallet',load)}},[])
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);addEventListener('online',update);addEventListener('offline',update);return()=>{removeEventListener('online',update);removeEventListener('offline',update)}},[])
 return <div className="min-h-screen"><GamepadBridge/><p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p><header className="nav"><a className="skip-link" href="#main" onClick={skipToMain}>Skip to main content</a><Link to="/" className="brand"><span className="brand-mark"><Gamepad2 size={20} strokeWidth={1.5}/></span><span>GoVibe<span className="text-cyan">Arcade</span></span></Link><nav aria-label="Main"><NavLink to="/" end>Discover</NavLink><a href="/#library">Library</a><NavLink to="/passport">Passport</NavLink><NavLink to="/online">Online</NavLink><NavLink to="/leaderboard">Leaderboard</NavLink></nav><Link to="/passport#shop" className="coins" aria-label={`${coins??0} coins`}><i aria-hidden="true"/>{coins??0}</Link><div className="status">{online?<><span className="status-dot"/>Online</>:<><WifiOff size={14}/>Offline ready</>}</div></header>{children}<footer><div className="footer-inner"><p>No tracking, no account, works offline once loaded, progress stays on your device.</p><nav aria-label="Footer"><Link to="/passport">Passport</Link><Link to="/online">Online</Link><Link to="/leaderboard">Leaderboard</Link><Link to="/about">About and privacy</Link></nav></div></footer></div>
}
