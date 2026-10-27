import { describe,expect,it } from 'vitest'
import { addTile,canMove,collapse,move } from './logic'
describe('Neon Merge logic',()=>{
 it('merges each pair only once',()=>{expect(collapse([2,2,2,2])).toEqual({row:[4,4,0,0],score:8})})
 it('moves a board left',()=>{expect(move([[0,2,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],'left').board[0]).toEqual([4,0,0,0])})
 it('adds a deterministic tile without mutation',()=>{const board=Array.from({length:4},()=>Array(4).fill(0));const next=addTile(board,()=>0);expect(next[0][0]).toBe(2);expect(board[0][0]).toBe(0)})
 it('recognizes a blocked board',()=>{expect(canMove([[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]])).toBe(false)})
})
