import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GravityFlip } from './GravityFlip'
import { LEVELS, par, solve, type Action } from './gravity/rules'

const KEY: Record<Action, string> = { L: 'ArrowLeft', R: 'ArrowRight', F: ' ' }

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <GravityFlip onFinish={onFinish} />
    </StrictMode>,
  )
  const player = () => view.container.querySelector('[data-testid="gf-player"]')!
  const pos = () => [Number(player().getAttribute('data-x')), Number(player().getAttribute('data-y'))]
  const play = (actions: Action[]) => actions.forEach((a) => fireEvent.keyDown(window, { key: KEY[a] }))
  return { onFinish, view, pos, play }
}

describe('Gravity Flip component', () => {
  it('starts on level 1 with the player resting on the floor', () => {
    const { pos } = setup()
    expect(screen.getByText('1/10')).toBeInTheDocument()
    expect(pos()).toEqual([1, 4])
  })

  it('moves with the keyboard and the on-screen buttons, and counts moves', () => {
    const { pos, play } = setup()
    play(['R'])
    expect(pos()).toEqual([2, 4])
    fireEvent.click(screen.getByRole('button', { name: 'Flip gravity' }))
    expect(pos()).toEqual([2, 1])
    fireEvent.click(screen.getByRole('button', { name: 'Move left' }))
    expect(screen.getByLabelText('Moves')).toHaveTextContent('3')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Moves')).toHaveTextContent('2')
  })

  it('reports a cleared level exactly once under StrictMode, with its stats', () => {
    const { onFinish, play } = setup()
    play(solve(0)!)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ score: 1000, won: true, stats: { level: 1, moves: par(0), par: par(0), stars: 3 } }))
    // Input after winning changes and reports nothing.
    play(['L', 'F'])
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Level cleared/)).toBeInTheDocument()
  })

  it('moves on to the next level and reports each cleared level once', () => {
    const { onFinish, play } = setup()
    play(solve(0)!)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next level' }))
    expect(screen.getByText('2/10')).toBeInTheDocument()
    play(solve(1)!)
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1][0].stats.level).toBe(2)
  })

  it('dying reports nothing and can be undone', () => {
    const { onFinish, play, view } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Next level' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next level' }))
    expect(screen.getByText('3/10')).toBeInTheDocument()
    play(['R', 'R', 'R'])
    expect(screen.getByText(/Spiked!/)).toBeInTheDocument()
    expect(view.container.querySelector('.gf-player.dead')).not.toBeNull()
    expect(onFinish).not.toHaveBeenCalled()
    play(['L']) // dead: ignored
    fireEvent.keyDown(window, { key: 'z' })
    expect(screen.queryByText(/Spiked!/)).toBeNull()
  })

  it('has every level reachable from the level buttons', () => {
    setup()
    for (let i = 1; i < LEVELS.length; i++) fireEvent.click(screen.getByRole('button', { name: 'Next level' }))
    expect(screen.getByText('10/10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next level' })).toBeDisabled()
  })
})
