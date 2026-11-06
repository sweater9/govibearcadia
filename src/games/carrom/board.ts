/**
 * The Phaser side of Carrom: draws the board, takes pointer aiming, and runs one shot with Matter physics.
 * It decides nothing about the rules. It reports a `ShotOutcome` and rules.ts does the rest.
 * This module (and Phaser with it) is only ever loaded through a dynamic import.
 */
import Phaser from 'phaser'
import { aimDir, angleFor, baseline, BOARD, CENTRE, COIN_R, POCKET_R, POCKETS, STRIKER_R, strikerAt, strikerBlocked, type Aim, type Coin, type ShotOutcome } from './rules'

export type BoardHandlers = {
  /** The player dragged the aim; merge it into the current aim. */
  onAim(aim: Partial<Aim>): void
  /** The player released the drag with enough power: strike. */
  onShoot(): void
}
export type BoardApi = {
  sync(coins: Coin[], seat: number, aim: Aim, canAim: boolean): void
  shoot(seat: number, aim: Aim): Promise<ShotOutcome>
  isMoving(): boolean
  destroy(): void
}

const STEP = 1000 / 120
const SPEED_MIN = 5
const SPEED_RANGE = 22
const COLOURS = { white: 0xf2efe6, black: 0x1c1c24, queen: 0xe0446a, striker: 0x3dd9f5 }

export function mountBoard(parent: HTMLElement, handlers: BoardHandlers): BoardApi {
  let scene!: CarromScene
  let ready: (() => void) | null = null
  const pending: (() => void)[] = []
  const queue = (fn: () => void) => (scene ? fn() : pending.push(fn))

  class CarromScene extends Phaser.Scene {
    coinObjs = new Map<number, { obj: Phaser.GameObjects.Arc; body?: MatterJS.BodyType; coin: Coin }>()
    strikerObj!: Phaser.GameObjects.Arc
    strikerBody: MatterJS.BodyType | null = null
    aimGfx!: Phaser.GameObjects.Graphics
    seat = 0
    aim: Aim = { t: 0, angle: 0, power: 0.55 }
    canAim = false
    coins: Coin[] = []
    dragging: 'striker' | 'slide' | null = null
    resolveShot: ((o: ShotOutcome) => void) | null = null
    pocketed: number[] = []
    strikerPocketed = false
    calmSteps = 0
    acc = 0

    constructor() {
      super('carrom')
    }
    create() {
      // Phaser constructs the scene, so the closure that owns the controls needs a handle to it.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      scene = this
      this.matter.world.autoUpdate = false
      this.matter.world.setGravity(0, 0)
      this.drawBoard()
      this.strikerObj = this.add.circle(0, 0, STRIKER_R, COLOURS.striker).setStrokeStyle(3, 0x06222a).setDepth(5)
      this.aimGfx = this.add.graphics().setDepth(4)
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p))
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p))
      this.input.on('pointerup', () => this.up())
      this.input.on('pointerupoutside', () => this.up())
      ready?.()
      for (const fn of pending.splice(0)) fn()
    }
    drawBoard() {
      const g = this.add.graphics()
      g.fillStyle(0x5a3a1e).fillRect(0, 0, BOARD, BOARD)
      g.fillStyle(0xe6c690).fillRect(8, 8, BOARD - 16, BOARD - 16)
      g.lineStyle(2, 0x3a2412)
      g.strokeCircle(CENTRE, CENTRE, 90).strokeCircle(CENTRE, CENTRE, 28)
      for (let seat = 0; seat < 4; seat++) {
        const b = baseline(seat)
        const a = { x: b.x - b.dx * 270, y: b.y - b.dy * 270 }
        const z = { x: b.x + b.dx * 270, y: b.y + b.dy * 270 }
        g.lineStyle(2, 0x3a2412).lineBetween(a.x, a.y, z.x, z.y)
        g.lineStyle(2, 0x3a2412).lineBetween(a.x + b.fx * 28, a.y + b.fy * 28, z.x + b.fx * 28, z.y + b.fy * 28)
      }
      g.fillStyle(0x16110c)
      for (const [x, y] of POCKETS) g.fillCircle(x, y, POCKET_R)
      g.setDepth(0)
    }
    wall(x: number, y: number, w: number, h: number) {
      this.matter.add.rectangle(x, y, w, h, { isStatic: true, restitution: 0.8, friction: 0 })
    }
    sync(coins: Coin[], seat: number, aim: Aim, canAim: boolean) {
      this.coins = coins
      this.seat = seat
      this.aim = aim
      this.canAim = canAim
      const live = new Set<number>()
      for (const c of coins) {
        if (c.pocketed) continue
        live.add(c.id)
        let e = this.coinObjs.get(c.id)
        if (!e) {
          const obj = this.add.circle(c.x, c.y, COIN_R, COLOURS[c.kind]).setStrokeStyle(2.5, c.kind === 'black' ? 0x6b6b7c : 0x8a7650).setDepth(2)
          e = { obj, coin: c }
          this.coinObjs.set(c.id, e)
        }
        e.coin = c
        e.obj.setPosition(c.x, c.y).setVisible(true)
      }
      for (const [id, e] of this.coinObjs) if (!live.has(id)) e.obj.setVisible(false)
      const p = strikerAt(seat, aim.t)
      this.strikerObj.setPosition(p.x, p.y).setVisible(canAim)
      this.strikerObj.setFillStyle(strikerBlocked(coins, seat, aim.t) ? 0xff6b6b : COLOURS.striker)
      this.drawAim()
    }
    drawAim() {
      const g = this.aimGfx
      g.clear()
      if (!this.canAim) return
      const p = strikerAt(this.seat, this.aim.t)
      const d = aimDir(this.seat, this.aim.angle)
      const len = 90 + this.aim.power * 330
      g.lineStyle(3, 0x1a1008, 0.95)
      for (let k = 0; k < len; k += 26) g.lineBetween(p.x + d.x * (STRIKER_R + k), p.y + d.y * (STRIKER_R + k), p.x + d.x * (STRIKER_R + Math.min(k + 14, len)), p.y + d.y * (STRIKER_R + Math.min(k + 14, len)))
    }
    down(p: Phaser.Input.Pointer) {
      if (!this.canAim || this.resolveShot) return
      const s = strikerAt(this.seat, this.aim.t)
      if (Math.hypot(p.worldX - s.x, p.worldY - s.y) < STRIKER_R * 2.2) this.dragging = 'striker'
      else {
        const b = baseline(this.seat)
        const along = (p.worldX - b.x) * b.dx + (p.worldY - b.y) * b.dy
        const across = Math.abs((p.worldX - b.x) * b.fx + (p.worldY - b.y) * b.fy)
        if (across < 50 && Math.abs(along) <= 290) {
          this.dragging = 'slide'
          handlers.onAim({ t: Math.max(-1, Math.min(1, along / 270)) })
        }
      }
    }
    move(p: Phaser.Input.Pointer) {
      if (!this.dragging) return
      const s = strikerAt(this.seat, this.aim.t)
      if (this.dragging === 'slide') {
        const b = baseline(this.seat)
        handlers.onAim({ t: Math.max(-1, Math.min(1, ((p.worldX - b.x) * b.dx + (p.worldY - b.y) * b.dy) / 270)) })
        return
      }
      // Slingshot: pull back from the striker; it fires the opposite way.
      const dx = s.x - p.worldX
      const dy = s.y - p.worldY
      const dist = Math.hypot(dx, dy)
      handlers.onAim({ angle: angleFor(this.seat, dx, dy), power: Math.max(0, Math.min(1, (dist - STRIKER_R) / 200)) })
    }
    up() {
      const was = this.dragging
      this.dragging = null
      if (was === 'striker' && this.aim.power > 0.1) handlers.onShoot()
    }
    startShot(seat: number, aim: Aim, done: (o: ShotOutcome) => void) {
      this.canAim = false
      this.aimGfx.clear()
      this.matter.world.remove(this.matter.world.getAllBodies())
      const m = 200
      this.wall(CENTRE, -m / 2 + 8, BOARD + 2 * m, m)
      this.wall(CENTRE, BOARD + m / 2 - 8, BOARD + 2 * m, m)
      this.wall(-m / 2 + 8, CENTRE, m, BOARD + 2 * m)
      this.wall(BOARD + m / 2 - 8, CENTRE, m, BOARD + 2 * m)
      const opts = (density: number) => ({ restitution: 0.82, friction: 0, frictionStatic: 0, frictionAir: 0.035, density })
      for (const e of this.coinObjs.values()) {
        if (e.coin.pocketed) continue
        e.body = this.matter.add.circle(e.coin.x, e.coin.y, COIN_R, opts(0.0012)) as MatterJS.BodyType
      }
      const p = strikerAt(seat, aim.t)
      this.strikerBody = this.matter.add.circle(p.x, p.y, STRIKER_R, opts(0.0024)) as MatterJS.BodyType
      this.strikerObj.setVisible(true)
      const d = aimDir(seat, aim.angle)
      const v = SPEED_MIN + aim.power * SPEED_RANGE
      this.matter.body.setVelocity(this.strikerBody, { x: d.x * v, y: d.y * v })
      this.pocketed = []
      this.strikerPocketed = false
      this.calmSteps = 0
      this.resolveShot = done
    }
    update(_t: number, delta: number) {
      if (!this.resolveShot) return
      this.acc += Math.min(delta, 50)
      while (this.acc >= STEP && this.resolveShot) {
        this.acc -= STEP
        this.step()
      }
      for (const e of this.coinObjs.values()) if (e.body && e.obj.visible) e.obj.setPosition(e.body.position.x, e.body.position.y)
      if (this.strikerBody) this.strikerObj.setPosition(this.strikerBody.position.x, this.strikerBody.position.y)
    }
    step() {
      this.matter.world.step(STEP)
      const inPocket = (x: number, y: number) => POCKETS.some(([px, py]) => Math.hypot(px - x, py - y) < POCKET_R)
      let fastest = 0
      for (const [id, e] of this.coinObjs) {
        if (!e.body || !e.obj.visible) continue
        if (inPocket(e.body.position.x, e.body.position.y)) {
          this.matter.world.remove(e.body)
          e.body = undefined
          e.obj.setVisible(false)
          this.pocketed.push(id)
          continue
        }
        fastest = Math.max(fastest, this.settle(e.body))
      }
      if (this.strikerBody) {
        if (inPocket(this.strikerBody.position.x, this.strikerBody.position.y)) {
          this.matter.world.remove(this.strikerBody)
          this.strikerBody = null
          this.strikerObj.setVisible(false)
          this.strikerPocketed = true
        } else fastest = Math.max(fastest, this.settle(this.strikerBody))
      }
      this.calmSteps = fastest === 0 ? this.calmSteps + 1 : 0
      if (this.calmSteps > 20) this.finish()
    }
    settle(body: MatterJS.BodyType): number {
      const sp = Math.hypot(body.velocity.x, body.velocity.y)
      if (sp < 0.06) {
        this.matter.body.setVelocity(body, { x: 0, y: 0 })
        return 0
      }
      return sp
    }
    finish() {
      const positions: Record<number, { x: number; y: number }> = {}
      for (const [id, e] of this.coinObjs) if (e.body) positions[id] = { x: e.body.position.x, y: e.body.position.y }
      const done = this.resolveShot!
      this.resolveShot = null
      this.matter.world.remove(this.matter.world.getAllBodies())
      for (const e of this.coinObjs.values()) e.body = undefined
      this.strikerBody = null
      done({ pocketed: this.pocketed.slice(), strikerPocketed: this.strikerPocketed, positions })
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: BOARD,
    height: BOARD,
    backgroundColor: '#5a3a1e',
    banner: false,
    audio: { noAudio: true },
    physics: { default: 'matter', matter: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: CarromScene,
  })
  ready = () => undefined

  return {
    sync: (coins, seat, aim, canAim) => queue(() => scene.sync(coins, seat, aim, canAim)),
    shoot: (seat, aim) => new Promise<ShotOutcome>((resolve) => queue(() => scene.startShot(seat, aim, resolve))),
    isMoving: () => !!scene?.resolveShot,
    destroy: () => game.destroy(true),
  }
}
