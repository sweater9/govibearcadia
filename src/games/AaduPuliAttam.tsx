import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Undo2 } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseMove } from './aadupuli/ai'
import { AaduPuliBoard } from './aadupuli/Board'
import { applyMove, legalMoves, movesFrom, newGame, scoreFor, type Side, type State } from './aadupuli/rules'
import { clearSaved, loadSaved, save, type Mode } from './aadupuli/save'

const THINK_MS = 420

export function AaduPuliAttam({ onFinish, seed }: GameProps) {
  const restored = useRef(loadSaved())
  const [mode, setMode] = useState<Mode>(() => restored.current?.mode ?? 'computer')
  const [human, setHuman] = useState<Side>(() => restored.current?.human ?? 'goats')
  const [game, setGame] = useState<State>(() => restored.current?.state ?? newGame())
  const [history, setHistory] = useState<State[]>(() => restored.current?.history ?? [])
  const [selected, setSelected] = useState<number | null>(null)
  const startedAt = useRef(Date.now())
  const random = useMemo(() => createRandom(seed), [seed])
  const computerTurn = mode === 'computer' && !game.winner && game.turn !== human

  useEffect(() => { if (!game.winner) save({ v: 1, mode, human, state: game, history }) }, [game, history, mode, human])

  const commit = useCallback((next: State) => {
    setHistory((old) => [...old, game])
    setGame(next)
    setSelected(null)
    if (next.winner) {
      clearSaved()
      onFinish({ score: scoreFor(next, mode === 'local' ? next.winner : human), durationMs: Date.now() - startedAt.current, won: mode === 'local' || next.winner === human, stats: { moves: next.moves, goatsCaptured: next.goatsCaptured, winner: next.winner === 'goats' ? 1 : 2 } })
    }
  }, [game, human, mode, onFinish])

  useEffect(() => {
    if (!computerTurn) return
    const timer = setTimeout(() => {
      const move = chooseMove(game, random, game.turn === 'tigers' ? 3 : 2)
      if (move) commit(applyMove(game, move))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [computerTurn, game, random, commit])

  const available = legalMoves(game)
  const selectedMoves = game.turn === 'goats' && game.goatsPlaced < 15 ? available : movesFrom(game, selected)
  const locked = !!game.winner || computerTurn

  const point = (at: number) => {
    if (locked) return
    const direct = selectedMoves.find((m) => m.to === at)
    if (direct) { commit(applyMove(game, direct)); return }
    if (available.some((m) => m.from === at)) setSelected(at)
    else setSelected(null)
  }

  const restart = (nextMode = mode, nextHuman = human) => {
    clearSaved(); setMode(nextMode); setHuman(nextHuman); setGame(newGame()); setHistory([]); setSelected(null); startedAt.current = Date.now()
  }
  const undo = () => {
    if (!history.length || computerTurn || game.winner) return
    const count = mode === 'computer' && game.turn === human && history.length > 1 ? 2 : 1
    const index = Math.max(0, history.length - count)
    setGame(history[index]); setHistory(history.slice(0, index)); setSelected(null)
  }
  const phase = game.goatsPlaced < 15 ? `${15 - game.goatsPlaced} goats left to place` : 'All goats placed — goats may move'
  const status = game.winner ? `${game.winner === 'goats' ? 'Goats' : 'Tigers'} win!` : computerTurn ? 'Computer is thinking…' : mode === 'local' ? `${game.turn === 'goats' ? 'Goats' : 'Tigers'} to play` : game.turn === human ? 'Your turn' : 'Computer turn'

  return <div className="ap">
    <div className="game-toolbar ap-toolbar">
      <div><small>{phase}</small><strong className="ap-status" aria-live="polite">{status}</strong></div>
      <div className="ap-actions">
        <button onClick={undo} disabled={!history.length || computerTurn || !!game.winner}><Undo2 size={15} /> Undo</button>
        <button onClick={() => restart()}><RotateCcw size={15} /> New</button>
      </div>
    </div>
    <div className="ap-options" aria-label="Game options">
      <label>Mode <select aria-label="Mode" value={mode} onChange={(e) => restart(e.target.value as Mode, human)}><option value="computer">Vs computer</option><option value="local">Two players</option></select></label>
      {mode === 'computer' ? <label>Play as <select aria-label="Play as" value={human} onChange={(e) => restart(mode, e.target.value as Side)}><option value="goats">Goats</option><option value="tigers">Tigers</option></select></label> : null}
      <span>Captured <b>{game.goatsCaptured}/5</b></span>
    </div>
    <AaduPuliBoard cells={game.cells} selected={selected} moves={selectedMoves} disabled={locked} onPoint={point} />
    <p className="game-help">Goats place all 15 before moving. Tigers step along a line or jump one goat. Tigers win after 5 captures; goats win by trapping all 3 tigers.</p>
    {game.winner ? <div className="game-over"><h3>{status}</h3><p>{game.moves} turns · {game.goatsCaptured} goats captured</p><button className="primary-btn" onClick={() => restart()}>Play again</button></div> : null}
  </div>
}
