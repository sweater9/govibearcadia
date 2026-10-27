import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
const icons=['◆','✦','●','▲','☾','⬡']
const makeDeck=()=>[...icons,...icons].map((symbol,i)=>({id:i,symbol,order:Math.random()})).sort((a,b)=>a.order-b.order)
export function MemoryGrid({onFinish}:{onFinish:(score:number)=>void}){const [deck,setDeck]=useState(makeDeck);const [open,setOpen]=useState<number[]>([]);const [matched,setMatched]=useState<number[]>([]);const [moves,setMoves]=useState(0)
 useEffect(()=>{if(open.length!==2)return;const [a,b]=open;if(deck[a].symbol===deck[b].symbol){setMatched(m=>[...m,a,b]);setOpen([])}else{const t=setTimeout(()=>setOpen([]),650);return()=>clearTimeout(t)}},[open,deck])
 useEffect(()=>{if(matched.length===deck.length&&moves){onFinish(Math.max(100,1200-moves*40))}},[matched.length,deck.length,moves,onFinish])
 const flip=(i:number)=>{if(open.length===2||open.includes(i)||matched.includes(i))return;setOpen(o=>[...o,i]);if(open.length===1)setMoves(m=>m+1)}
 const restart=()=>{setDeck(makeDeck());setOpen([]);setMatched([]);setMoves(0)}
 return <div className="memory"><div className="game-toolbar"><div><small>Moves</small><strong>{moves}</strong></div><button onClick={restart}><RotateCcw size={16}/>Reset</button></div><div className="memory-grid">{deck.map((card,i)=>{const shown=open.includes(i)||matched.includes(i);return <button key={card.id} className={shown?'flipped':''} onClick={()=>flip(i)} aria-label={shown?card.symbol:'Hidden card'}><span>{shown?card.symbol:'?'}</span></button>})}</div>{matched.length===deck.length?<div className="win-message">Perfect sync! Score {Math.max(100,1200-moves*40)}</div>:null}</div>}
