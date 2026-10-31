/** Ghata Bara deterministic rules engine. No UI, storage, randomness, or network. */
export type Player = 0|1|2|3;
export type Die = 1|2|3|6;
export type Cell = readonly [number,number];
export type Phase = 'rolling'|'moving'|'won';
export type Pawn = {id:number;owner:Player;step:number;credit:boolean;juga:number|null;pinnedBy:number|null};
export type State = {pawns:Pawn[];player:Player;phase:Phase;queue:number[];streak:number;capturesInSequence:boolean;winner:Player|null;sequence:number;lastEvent:string};
export type Move = {ids:number[];chunkIndices:number[];points:number;destination:Cell;captures:number[];pin:number|null};
const outer:Cell[]=[[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[4,1]];
const inner:Cell[]=[[3,2],[3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3]];
export const starts:Cell[]=[[4,2],[2,4],[0,2],[2,0]];
export const safe=new Set(['4,2','2,4','0,2','2,0','2,2']);
export const key=(c:Cell)=>c.join(',');
export const isSafe=(c:Cell)=>safe.has(key(c));
export const route=(owner:Player):Cell[]=>{
 const start=outer.findIndex(c=>key(c)===key(starts[owner]));
 const offset=[0,6,4,2][owner];
 return [...Array.from({length:16},(_,i)=>outer[(start+i)%16]),...Array.from({length:8},(_,i)=>inner[(i+offset)%8]),[2,2] as Cell];
};
export function initial():State{return {pawns:Array.from({length:24},(_,id)=>({id,owner:Math.floor(id/6) as Player,step:-1,credit:false,juga:null,pinnedBy:null})),player:0,phase:'rolling',queue:[],streak:0,capturesInSequence:false,winner:null,sequence:0,lastEvent:'New game'};}
export function diceTotal(a:Die,b:Die){if(![1,2,3,6].includes(a)||![1,2,3,6].includes(b))throw Error('Invalid die');return a+b;}
export function at(s:State,p:Pawn):Cell|null{return p.step<0?null:route(p.owner)[p.step];}
const same=(a:Cell|null,b:Cell|null)=>!!a&&!!b&&key(a)===key(b);
function clone(s:State):State{return {...s,pawns:s.pawns.map(p=>({...p})),queue:[...s.queue]};}
export function nextPlayer(s:State):State{return {...s,player:((s.player+1)%4) as Player,phase:'rolling',queue:[],streak:0,capturesInSequence:false,sequence:s.sequence+1,lastEvent:'Next player'};}
export function roll(s:State,a:Die,b:Die):State{
 if(s.phase!=='rolling')throw Error('Finish movement before rolling');
 const total=diceTotal(a,b),bonus=total===6||total===12,streak=bonus?s.streak+1:0;
 if(streak===3)return {...nextPlayer(s),lastEvent:'Three-strike bust'};
 const queue=[...s.queue,total];
 if(bonus)return {...s,queue,streak,lastEvent:'Bonus roll'};
 const next={...s,queue,streak:0,phase:'moving' as Phase,lastEvent:'Allocate movement'};
 return legalMoves(next).length?next:{...nextPlayer(next),lastEvent:'No legal moves; automatic pass'};
}
function groups(s:State):number[][]{
 const ours=s.pawns.filter(p=>p.owner===s.player&&p.step!==24&&p.pinnedBy===null);
 const grouped=new Set<number>();const result:number[][]=[];
 for(const p of ours){if(grouped.has(p.id))continue;
  const ids=p.juga===null?[p.id]:ours.filter(q=>q.juga===p.juga).map(q=>q.id);
  ids.forEach(id=>grouped.add(id));if(ids.length===(p.juga===null?1:2))result.push(ids);
 }
 return result;
}
function combos(q:number[]):number[][]{
 const result:number[][]=[];
 for(let mask=1;mask<(1<<q.length);mask++){const indices=q.flatMap((_,i)=>mask&(1<<i)?[i]:[]);result.push(indices);}
 return result;
}
function getJuga(s:State,p:Pawn){return p.juga===null?[]:s.pawns.filter(q=>q.juga===p.juga);}
function evaluate(s:State,ids:number[],indices:number[]):Move|null{
 const units=ids.map(id=>s.pawns[id]);if(!units.length||units.some(p=>!p||p.owner!==s.player||p.pinnedBy!==null))return null;
 const points=indices.reduce((n,i)=>n+s.queue[i],0),paired=units.length===2;
 if(paired&&points%2)return null;
 const first=units[0];if(first.step===24)return null;
 if(first.step<0){if(paired||indices.length!==1||![6,12].includes(points))return null;}
 const distance=first.step<0?0:paired?points/2:points;
 const destinationStep=first.step<0?0:first.step+distance;
 if(destinationStep>24)return null;
 if(first.step>=0&&first.step<16&&destinationStep>=16&&!first.credit)return null;
 const destination=route(s.player)[destinationStep];
 const path=first.step<0?[]:Array.from({length:distance},(_,i)=>route(s.player)[first.step+i+1]);
 if(path.some(c=>!c))return null;
 // A pawn with no capture credit may circulate the outer ring.
 let finalStep=destinationStep;let dest=destination;
 if(first.step>=0&&first.step<16&&destinationStep>=16&&!first.credit){finalStep=destinationStep%16;dest=route(s.player)[finalStep];}
 const enemies=s.pawns.filter(p=>p.owner!==s.player&&p.step>=0&&p.step<24);
 const blockers=enemies.filter(p=>p.juga!==null);
 if(!paired&&path.some(c=>!isSafe(c)&&blockers.some(p=>same(at(s,p),c))))return null;
 const destinationOccupants=s.pawns.filter(p=>p.step>=0&&p.step<24&&same(at(s,p),dest)&&!ids.includes(p.id));
 const friends=destinationOccupants.filter(p=>p.owner===s.player);
 const foes=destinationOccupants.filter(p=>p.owner!==s.player);
 if(!isSafe(dest)){
  if(friends.some(p=>p.juga!==null)||friends.length+units.length>2)return null;
  if(!paired&&foes.some(p=>p.juga!==null))return null;
  if(paired&&foes.filter(p=>p.juga===null).length>1)return null;
  if(paired&&foes.some(p=>p.juga!==null)&&foes.some(p=>p.juga===null))return null;
 }
 let captures:number[]=[],pin:number|null=null;
 if(!isSafe(dest)){
  if(paired){const targetJuga=foes.find(p=>p.juga!==null);
   if(targetJuga)captures=getJuga(s,targetJuga).map(p=>p.id);
   else if(foes.length===1)pin=foes[0].id;
  }else captures=foes.map(p=>p.id);
 }
 if(paired){const pinned=s.pawns.filter(p=>p.pinnedBy===first.juga);captures=[...new Set([...captures,...pinned.map(p=>p.id)])];}
 return {ids,chunkIndices:indices,points,destination:dest,captures,pin};
}
export function legalMoves(s:State):Move[]{
 if(s.phase!=='moving')return [];
 const moves:Move[]=[];
 for(const ids of groups(s))for(const indices of combos(s.queue)){const m=evaluate(s,ids,indices);if(m)moves.push(m);}
 return moves;
}
export function move(s:State,ids:number[],chunkIndices:number[]):State{
 if(s.phase!=='moving')throw Error('Not in movement phase');
 const indices=[...new Set(chunkIndices)].sort((a,b)=>a-b),selected=[...ids].sort((a,b)=>a-b);
 const m=legalMoves(s).find(x=>x.ids.join(',')===selected.join(',')&&x.chunkIndices.join(',')===indices.join(','));
 if(!m)throw Error('Illegal allocation');
 const next=clone(s),moving=selected.map(id=>next.pawns[id]),from=moving[0].step;
 const paired=moving.length===2,step=from<0?0:from+m.points/(paired?2:1);
 for(const p of moving){p.step=step;p.pinnedBy=null;}
 for(const id of m.captures){const p=next.pawns[id];p.step=-1;p.credit=false;p.juga=null;p.pinnedBy=null;}
 // Rescue releases the pinned pawn, without repinning it.
 if(m.captures.some(id=>s.pawns[id].juga!==null)){
  const defeated=new Set(m.captures.map(id=>s.pawns[id].juga).filter(x=>x!==null));
  for(const p of next.pawns)if(p.pinnedBy!==null&&defeated.has(p.pinnedBy))p.pinnedBy=null;
 }
 if(m.pin!==null)next.pawns[m.pin].pinnedBy=moving[0].juga;
 if(m.captures.length){moving.forEach(p=>p.credit=true);next.capturesInSequence=true;}
 next.queue=next.queue.filter((_,i)=>!indices.includes(i));
 // Mandatory Juga formation on the inner ring, after any opponent enters the inner ring.
 const anyOpponentInside=next.pawns.some(p=>p.owner!==s.player&&p.step>=16&&p.step<24);
 if(anyOpponentInside&&step>=16&&step<24){
  const companions=next.pawns.filter(p=>p.owner===s.player&&p.step===step&&p.juga===null&&p.credit);
  if(companions.length===2){const juga=Math.max(0,...next.pawns.map(p=>p.juga??0))+1;companions.forEach(p=>p.juga=juga);}
 }
 if(next.pawns.filter(p=>p.owner===s.player).every(p=>p.step===24))return {...next,winner:s.player,phase:'won',queue:[],lastEvent:'Victory'};
 if(legalMoves(next).length===0){
  if(next.capturesInSequence)return {...next,phase:'rolling',queue:[],streak:0,capturesInSequence:false,sequence:next.sequence+1,lastEvent:'Capture bonus sequence'};
  return {...nextPlayer(next),lastEvent:'Turn complete'};
 }
 return {...next,lastEvent:m.captures.length?'Capture':'Moved'};
}
export function completeSequence(s:State):State{
 if(s.phase!=='moving'||legalMoves(s).length)throw Error('Legal moves remain');
 if(s.capturesInSequence)return {...s,phase:'rolling',queue:[],streak:0,capturesInSequence:false,sequence:s.sequence+1,lastEvent:'Capture bonus sequence'};
 return nextPlayer(s);
}
export function serialize(s:State){return JSON.stringify(s);}
export function restore(raw:string):State{const s=JSON.parse(raw) as State;if(!Array.isArray(s.pawns)||s.pawns.length!==24||!['rolling','moving','won'].includes(s.phase))throw Error('Invalid save');return s;}
