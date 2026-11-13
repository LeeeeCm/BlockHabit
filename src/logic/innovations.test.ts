import { describe, it, expect, beforeEach } from 'vitest'
import { currentStreakWithResilience } from './streak'
import { getTimePeriod, paletteFromDocument } from '../render/iso'
import { playSnapSound, setSoundMuted } from '../audio/sound'
import { useAppStore } from '../store/appStore'
import { addDays, dateKey } from './dates'
import type { Habit, CheckIn } from '../types'

describe('全量创新特性单元与边界测试 (Innovations Test Suite)', () => {
  beforeEach(() => {
    useAppStore.setState({
      habits: [],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: {
        theme: 'light',
        language: 'zh',
        enableMiniWidget: false,
        enableAmbientLighting: true,
        enableGentleDecay: true,
        enableEcoProps: true,
        soundMaterial: 'classic',
        enableGyroscope: false,
        enableXRayInspection: false
      },
      dayClaims: [],
      repairBricks: 0,
      showcasePlacements: [],
      foundationNotes: {},
      hydrated: true
    })
  })

  describe('1. 温和抗断卡韧性机制 (Gentle Decay Resilience)', () => {
    const dailyHabit: Habit = {
      id: 'h-meditate',
      name: '正念冥想',
      frequency: { type: 'daily' },
      createdAt: '2026-01-01T00:00:00.000Z'
    }

    it('经典硬核模式下 (enableGentleDecay=false)，昨日断卡连胜直接归零', () => {
      const today = new Date('2026-03-25T12:00:00.000Z')
      const dDayBefore = addDays(today, -2) // 2026-03-23
      const checkIns: CheckIn[] = [
        {
          id: 'c1',
          habitId: 'h-meditate',
          date: dateKey(dDayBefore),
          at: `${dateKey(dDayBefore)}T08:00:00.000Z`
        }
      ]

      const status = currentStreakWithResilience(dailyHabit, checkIns, today, false)
      expect(status.streak).toBe(0)
      expect(status.inRestPeriod).toBe(false)
    })

    it('温和风化模式下 (enableGentleDecay=true)，昨日偶发断卡进入晨雾休整期，展示被保护的连胜', () => {
      const today = new Date('2026-03-25T12:00:00.000Z')
      const dDayBefore = addDays(today, -2) // 2026-03-23
      const dThreeDaysAgo = addDays(today, -3) // 2026-03-22
      const checkIns: CheckIn[] = [
        {
          id: 'c0',
          habitId: 'h-meditate',
          date: dateKey(dThreeDaysAgo),
          at: `${dateKey(dThreeDaysAgo)}T08:00:00.000Z`
        },
        {
          id: 'c1',
          habitId: 'h-meditate',
          date: dateKey(dDayBefore),
          at: `${dateKey(dDayBefore)}T08:00:00.000Z`
        }
      ]

      const status = currentStreakWithResilience(dailyHabit, checkIns, today, true)
      expect(status.streak).toBe(2)
      expect(status.inRestPeriod).toBe(true)
      expect(status.missedDays).toBe(1)
    })

    it('温和风化模式下，今日打卡成功跨越昨日断卡缝隙，连胜接续为 pastStreak + 1', () => {
      const today = new Date('2026-03-25T12:00:00.000Z')
      const todayStr = dateKey(today)
      const dDayBefore = addDays(today, -2)
      const dThreeDaysAgo = addDays(today, -3)
      const checkIns: CheckIn[] = [
        {
          id: 'c0',
          habitId: 'h-meditate',
          date: dateKey(dThreeDaysAgo),
          at: `${dateKey(dThreeDaysAgo)}T08:00:00.000Z`
        },
        {
          id: 'c1',
          habitId: 'h-meditate',
          date: dateKey(dDayBefore),
          at: `${dateKey(dDayBefore)}T08:00:00.000Z`
        },
        // 今日打卡
        { id: 'c-today', habitId: 'h-meditate', date: todayStr, at: `${todayStr}T08:00:00.000Z` }
      ]

      const status = currentStreakWithResilience(dailyHabit, checkIns, today, true)
      // 2 天历史连胜 + 今日打卡 = 3 连胜，休整期结束
      expect(status.streak).toBe(3)
      expect(status.inRestPeriod).toBe(false)
    })
  })

  describe('2. 时段感知昼夜环境光照 (Time-adaptive Ambient Lighting)', () => {
    it('正确识别 24 小时各自然时段 (Dawn, Noon, Dusk, Night)', () => {
      expect(getTimePeriod(7)).toBe('dawn')
      expect(getTimePeriod(12)).toBe('noon')
      expect(getTimePeriod(17)).toBe('dusk')
      expect(getTimePeriod(22)).toBe('night')
      expect(getTimePeriod(2)).toBe('night')
    })

    it('开启环境光照时按时段调制返回微暖或夜灯光泽调色板', () => {
      const pStd = paletteFromDocument(undefined, false)
      const pAmbient = paletteFromDocument(undefined, true)
      expect(pStd).toBeDefined()
      expect(pAmbient).toBeDefined()
      expect(pAmbient.top).toBeDefined()
      expect(pAmbient.left).toBeDefined()
      expect(pAmbient.right).toBeDefined()
    })
  })

  describe('3. 物理拟真 ASMR 音效系统 (Physical Audio Synthesizer)', () => {
    it('支持按不同物理材质触发声学合成而不抛出异常', () => {
      expect(() => playSnapSound('classic')).not.toThrow()
      expect(() => playSnapSound('walnut')).not.toThrow()
      expect(() => playSnapSound('crystal')).not.toThrow()
      expect(() => playSnapSound('metal')).not.toThrow()
      expect(() => playSnapSound('mute')).not.toThrow()
    })

    it('静音模式下静默返回', () => {
      setSoundMuted(true)
      expect(() => playSnapSound('classic')).not.toThrow()
      setSoundMuted(false)
    })
  })

  describe('4. 全局偏好与感官设置状态机 (updateSettings)', () => {
    it('updateSettings 支持局部增量更新并保持其他字段不变', () => {
      const store = useAppStore.getState()
      expect(store.settings.soundMaterial).toBe('classic')
      expect(store.settings.enableAmbientLighting).toBe(true)

      store.updateSettings({ soundMaterial: 'walnut', enableGyroscope: true })

      const updated = useAppStore.getState().settings
      expect(updated.soundMaterial).toBe('walnut')
      expect(updated.enableGyroscope).toBe(true)
      expect(updated.enableAmbientLighting).toBe(true) // 保持不变
    })
  })
})
