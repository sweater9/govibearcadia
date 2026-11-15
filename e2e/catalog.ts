import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The game catalogue as the e2e suite needs it, read straight from `src/games/catalog/*.ts` so a new game never has to be
 * added to a test list by hand. A unit test (`src/games/catalog.test.ts`) checks this reading matches the real registry.
 */
export type CatalogRow = { order: number; id: string; title: string; category: string; playArea: string; chunk: string }

const DIR = join(process.cwd(), 'src', 'games', 'catalog')
const pick = (text: string, re: RegExp, file: string): string => {
  const m = re.exec(text)
  if (!m) throw new Error(`${file}: could not read ${re}`)
  return m[1]
}

export function readCatalog(dir: string = DIR): CatalogRow[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8')
      return {
        order: Number(pick(text, /^\s+order: (\d+),/m, file)),
        id: pick(text, /^\s+id: '([^']+)',/m, file),
        title: pick(text, /^\s+title: '((?:[^'\\]|\\.)*)',/m, file).replace(/\\'/g, "'"),
        category: pick(text, /^\s+category: '([^']+)',/m, file),
        playArea: pick(text, /^\s+playArea: '([^']+)',/m, file),
        chunk: pick(text, /import\('\.\.\/(\w+)'\)/, file),
      }
    })
    .sort((a, b) => a.order - b.order)
}
