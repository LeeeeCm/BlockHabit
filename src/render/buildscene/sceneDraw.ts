import {
  DEFAULT_ISO_CONFIG,
  drawCube,
  drawEcoProps,
  drawGroundBase,
  drawGroundShadow,
  paletteFromDocument,
  worldToScreen
} from '../iso'
import { BLOCK_T, DROP_MS, animState, cascadeState } from '../sceneMotion'
import type { SceneRuntime } from './sceneTypes'

/**
 * 绘制单帧建造场景（拆分自 BuildScene.tsx 的 draw 闭包，逐语句搬运）：
 * 地基 → 接触阴影 → back 植被 → 积木（级联 / 新块慢落 / 静态）→ front 植被，
 * 末尾按动画状态决定续帧或触发 onAnimated。
 *
 * 所有可变状态都经 runtime 的 ref 实时读取，同步续帧（redraw）能立刻看到最新的
 * animRef / cascadeRef，行为与拆分前完全一致。
 */
export function drawScene(rt: SceneRuntime) {
  const canvas = rt.canvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const {
    blueprint: bp,
    placedCount: pc,
    animateIndex: ai,
    rotation: rot,
    enableAmbient: ambient,
    enableGyroscope: gyroEnabled
  } = rt.stateRef.current
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

  const palette = paletteFromDocument(undefined, ambient)
  const view = rt.viewRef.current
  const gyro = gyroEnabled ? rt.gyroOffsetRef.current : { x: 0, y: 0 }
  ctx.translate(view.panX + gyro.x, view.panY + gyro.y)
  ctx.scale(view.scale, view.scale)

  const { cx, cy, sortedCubes: cubes, indexAt, blockMetaByIndex } = rt.derivedRef.current
  rt.cubesRef.current = cubes

  const cfg = DEFAULT_ISO_CONFIG
  drawGroundBase(ctx, bp.blocks, cfg, palette, rot, cx, cy)
  // 接触阴影跟随已放置积木的脚印（开荒期不应出现比建筑大几圈的阴影）
  const placedBlocks = cubes.filter((c) => c.i < pc).map((c) => ({ x: c.b.x, y: c.b.y }))
  drawGroundShadow(ctx, placedBlocks, cfg, palette, rot, cx, cy)
  // 植被 back 层：左/右侧灌木（积木之前绘制，被建筑自然遮挡、只在侧面探出）
  drawEcoProps(ctx, bp.blocks, cfg, palette, rot, cx, cy, rt.stateRef.current.ecoStage, 'back')

  const now = performance.now()
  const anim = rt.animRef.current
  const cascade = rt.cascadeRef.current
  let animating = false
  let a = { z: 0, sx: 1, sy: 1 }
  if (anim) {
    const p = Math.min(1, (now - anim.start) / DROP_MS)
    a = animState(p)
    animating = p < 1
  }

  let cascadeRunning = false
  for (const { b, i, rx, ry } of cubes) {
    if (i >= pc) continue
    const isNew = anim && ai != null && i === ai && ai === pc - 1
    const aboveIdx = indexAt.get(`${b.x},${b.y},${b.z + 1}`)
    let aboveLanded = true
    if (aboveIdx !== undefined) {
      if (cascade) {
        aboveLanded = now - cascade.start - cascade.starts[aboveIdx] >= BLOCK_T
      } else if (anim && animating && aboveIdx === ai) {
        aboveLanded = false
      }
    }

    const meta = blockMetaByIndex.get(i)
    const ci = meta?.ci
    const hasNote = Boolean(ci?.note?.trim())
    const starred = Boolean(ci?.starred)
    const isHovered = Boolean(rt.interactiveInspect && rt.hoveredIndexRef.current === i)

    const isGhostXRay = Boolean(rt.stateRef.current.xrayMode && !hasNote)
    const isGlowXRay = Boolean(rt.stateRef.current.xrayMode && hasNote)

    const faceOpts = {
      type: b.type,
      color: isGlowXRay ? palette.accent : b.color,
      noStuds: aboveIdx !== undefined && aboveLanded,
      hasNote,
      starred,
      // B1：连击里程碑奖励块 —— 由 iso.ts:672 的分支绘制点缀色顶面描边（此前从未被传入过）
      // B5：奖励块两个等级——全勤（来自 __day__ 的 DayClaim）双环，连击里程碑单环
      bonus: Boolean(meta?.pb?.bonus),
      bonusTier: meta?.pb?.bonus
        ? meta.pb.fromHabitId === '__day__'
          ? ('attendance' as const)
          : ('streak' as const)
        : undefined,
      ghost: isGhostXRay,
      highlight: isHovered || isGlowXRay || Boolean(isNew && !animating)
    }

    // 级联铺设：逐层落下 + 果冻回弹
    if (cascade && !isNew) {
      const el = now - cascade.start - cascade.starts[i]
      if (el < 0) continue
      const st = cascadeState(el)
      if (!st.done) {
        cascadeRunning = true
        const { sx: cxS, sy: syBase } = worldToScreen(rx, ry, b.z, cfg)
        if (st.sx !== 1 || st.sy !== 1) {
          ctx.save()
          ctx.translate(cxS, syBase + cfg.tileH / 2 + cfg.blockH - st.z * cfg.blockH)
          ctx.scale(st.sx, st.sy)
          drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, faceOpts)
          ctx.restore()
        } else {
          const { sx: px, sy: py } = worldToScreen(rx, ry, b.z + st.z, cfg)
          drawCube(ctx, px, py, cfg, palette, faceOpts)
        }
        continue
      }
    }

    // 静态/新块路径：块自身高度 b.z + 动画偏移（zOff：下落抬升量）
    const zOff = isNew ? a.z : 0
    const { sx: px, sy: restSy } = worldToScreen(rx, ry, b.z, cfg)
    if (isNew && (a.sx !== 1 || a.sy !== 1)) {
      // 以静止底边为锚点缩放，抬升量只计一次
      ctx.save()
      ctx.translate(px, restSy + cfg.tileH / 2 + cfg.blockH - zOff * cfg.blockH)
      ctx.scale(a.sx, a.sy)
      drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, faceOpts)
      ctx.restore()
    } else {
      drawCube(ctx, px, restSy - zOff * cfg.blockH, cfg, palette, faceOpts)
    }
  }

  // 植被 front 层：前部灌木/树（积木之后绘制，站在建筑前面完全可见）
  drawEcoProps(ctx, bp.blocks, cfg, palette, rot, cx, cy, rt.stateRef.current.ecoStage, 'front')

  if (cascade) {
    cascadeRunning = cascadeRunning || now - cascade.start < cascade.total
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const scheduleNextFrame = () => {
    if (rt.rafRef.current !== null) {
      cancelAnimationFrame(rt.rafRef.current)
    }
    rt.rafRef.current = requestAnimationFrame(() => {
      rt.rafRef.current = null
      rt.redraw()
    })
  }

  if (anim && animating) {
    scheduleNextFrame()
  } else if (anim) {
    rt.animRef.current = null
    rt.redraw()
    rt.onAnimatedRef.current?.()
  } else if (cascadeRunning) {
    scheduleNextFrame()
  } else if (cascade) {
    rt.cascadeRef.current = null
    rt.redraw()
  }
}
