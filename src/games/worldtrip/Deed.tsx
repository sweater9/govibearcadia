import { BOARD, CENTRE_COST, GROUP_COLOURS, GROUPS, isClaimable } from './board'
import { feeAt, money, mortgageValue, type State } from './rules'
import { LandmarkArt } from './Landmark'

const PLAYER_COLOURS = ['#b4542c', '#2f6f9f', '#2f6b45', '#7a4fa0']

/**
 * A title deed for one claimable stop, laid out like a board-game property card: a colour band, the name, the rent ladder, then price and mortgage.
 * The rent row that applies right now (whole colour set, visitor centre, how many airports are held) is marked, so the card also explains the fee.
 */
export function Deed({ state, index, name, compact }: { state: State; index: number; name: (i: number) => string; compact?: boolean }) {
  const space = BOARD[index]
  if (!isClaimable(space)) return null
  const holding = state.holdings[index]
  const colour = space.kind === 'city' ? GROUP_COLOURS[space.group] : space.kind === 'airport' ? '#4b5b6e' : '#6b5a3a'
  const label = space.kind === 'city' ? 'Title deed' : space.kind === 'airport' ? 'Airport' : 'Travel service'
  const fee = space.fee
  const heldOf = holding ? state.holdings.filter((h, i) => h?.owner === holding.owner && BOARD[i].kind === space.kind).length : 0
  const setOwned = holding && space.kind === 'city' ? GROUPS[space.group].every((i) => state.holdings[i]?.owner === holding.owner) : false
  const rows: { text: string; value: number; now: boolean }[] = space.kind === 'city' ? [
    { text: 'Visitor fee', value: fee, now: !!holding && !setOwned && !holding.centre },
    { text: 'With every city in the colour', value: fee * 2, now: setOwned && !holding!.centre },
    { text: 'With a visitor centre', value: fee * 4, now: !!holding?.centre },
  ] : [1, 2, 3, 4].map((n) => ({ text: `${n} ${space.kind === 'airport' ? (n === 1 ? 'airport' : 'airports') : (n === 1 ? 'service' : 'services')} owned`, value: fee * n, now: heldOf === n }))
  return <article className={`wt-deed${compact ? ' wt-deed-compact' : ''}`} aria-label={`Deed: ${space.name}`} data-mortgaged={holding?.mortgaged ? 'true' : undefined}>
    <header style={{ background: colour }}>
      <small>{label}</small>
      <h4>{space.name}</h4>
      {space.kind === 'city' ? <span>{space.country}</span> : null}
      {holding ? <b className="wt-deed-owner" style={{ background: PLAYER_COLOURS[holding.owner] }} title={`Owned by ${name(holding.owner)}`}>{holding.owner + 1}</b> : null}
    </header>
    {space.kind === 'city' && !compact ? <div className="wt-deed-art"><LandmarkArt kind={space.landmark} city={space.name} /></div> : null}
    <dl>
      {rows.map((r) => <div key={r.text} data-now={r.now ? 'true' : undefined}><dt>{r.text}</dt><dd>{money(r.value)}</dd></div>)}
    </dl>
    <footer>
      <p><span>Price</span><strong>{money(space.price)}</strong></p>
      <p><span>Mortgage value</span><strong>{money(mortgageValue(space))}</strong></p>
      {space.kind === 'city' ? <p><span>Visitor centre</span><strong>{money(CENTRE_COST[space.group])}</strong></p> : null}
    </footer>
    {holding ? <p className="wt-deed-state">{holding.mortgaged ? 'Mortgaged: no fees collected' : `Fee now ${money(feeAt(state, index))}`}{holding.centre ? ' · visitor centre' : ''}</p> : <p className="wt-deed-state">For sale</p>}
  </article>
}
