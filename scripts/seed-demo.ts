/**
 * 演示存档生成脚本：产出 demo-state.json（全部蓝图建成状态），
 * 用于本地演示 / 截图走查；输出到 scripts/fixtures/demo-state.json。
 * 运行：npx vite-node scripts/seed-demo.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AppState, PlacedBlock } from '../src/types'
import { blueprints, blueprintOrder } from '../src/logic/blueprints'
import { validateState } from '../src/storage/adapter'
import { STATE_KEY } from '../src/storage/adapter'

const builds: PlacedBlock[] = []
// 起始时间：较早的过去，逐块递增 1 小时
let ts = new Date('2026-07-01T09:00:00.000Z').getTime()

for (const bpId of blueprintOrder) {
  const bp = blueprints[bpId]
  for (let i = 0; i < bp.blocks.length; i++) {
    ts += 3_600_000
    builds.push({
      id: `${bpId}-${i}`,
      blueprintId: bpId,
      index: i,
      placedAt: new Date(ts).toISOString(),
      fromHabitId: '__day__',
      bonus: false,
    })
  }
}

const state: AppState = {
  schemaVersion: 1,
  habits: [],
  checkIns: [],
  builds,
  activeBlueprintId: blueprintOrder[0],
  completedBlueprintIds: [...blueprintOrder],
  settings: { theme: 'light' },
  dayClaims: [],
}

if (!validateState(state).ok) {
  console.error('FAIL: 生成的 state 未通过 validateState 校验')
  process.exit(1)
}

const fixturesDir = resolve(process.cwd(), 'scripts', 'fixtures')
mkdirSync(fixturesDir, { recursive: true })
const outPath = resolve(fixturesDir, 'demo-state.json')
writeFileSync(outPath, JSON.stringify(state, null, 2), 'utf-8')

console.log(`localStorage key : ${STATE_KEY}`)
console.log(`蓝图数量        : ${blueprintOrder.length}`)
for (const id of blueprintOrder) {
  const n = builds.filter((b) => b.blueprintId === id).length
  console.log(`  - ${id.padEnd(10)} blocks=${String(n).padStart(3)} / ${blueprints[id].blocks.length}`)
}
console.log(`builds 总数     : ${builds.length}`)
console.log(`输出文件        : ${outPath}`)
