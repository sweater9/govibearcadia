import {describe,it,expect} from 'vitest';
import {initial,diceTotal,roll,legalMoves,move,route,starts,isSafe,restore,serialize} from './engine';
describe('Ghata Bara rules',()=>{
 it('has 24 yard pawns and symmetrical player starts',()=>{const s=initial();expect(s.pawns).toHaveLength(24);expect(s.pawns.every(p=>p.step===-1)).toBe(true);for(let i=0;i<4;i++)expect(route(i as 0|1|2|3)[0]).toEqual(starts[i]);});
 it('validates both traditional dice and all possible totals',()=>{const results=new Set<number>();for(const a of [1,2,3,6] as const)for(const b of [1,2,3,6] as const)results.add(diceTotal(a,b));expect([...results].sort((a,b)=>a-b)).toEqual([2,3,4,5,6,7,8,9,12]);});
 it('passes automatically if a player cannot leave yard',()=>{const s=roll(initial(),1,2);expect(s.player).toBe(1);expect(s.phase).toBe('rolling');});
 it('accumulates bonus rolls before movement',()=>{let s=roll(initial(),3,3);expect(s.phase).toBe('rolling');s=roll(s,1,2);expect(s.phase).toBe('moving');expect(s.queue).toEqual([6,3]);});
 it('busts on third special roll without moving',()=>{let s=roll(initial(),3,3);s=roll(s,6,6);s=roll(s,3,3);expect(s.player).toBe(1);expect(s.queue).toEqual([]);expect(s.pawns.every(p=>p.step===-1)).toBe(true);});
 it('consumes a full release chunk',()=>{let s=roll(initial(),3,3);s=roll(s,1,1);const m=legalMoves(s).find(x=>x.points===6);expect(m).toBeDefined();s=move(s,m!.ids,m!.chunkIndices);expect(s.pawns[0].step).toBe(0);expect(s.queue).toEqual([2]);});
 it('rejects a partial chunk and preserves exact entry',()=>{let s=roll(initial(),6,6);s=roll(s,1,1);expect(legalMoves(s).every(m=>m.points!==3)).toBe(true);expect(()=>move(s,[0],[1])).toThrow();});
 it('marks safe cells',()=>{expect(isSafe([2,2])).toBe(true);expect(isSafe([4,2])).toBe(true);expect(isSafe([3,3])).toBe(false);});
 it('supports save and restore',()=>{expect(restore(serialize(initial()))).toEqual(initial());expect(()=>restore('{}')).toThrow();});
});