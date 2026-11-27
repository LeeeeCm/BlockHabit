import { DEFAULT_ISO_CONFIG, STUD_H, worldToScreen, type Pt } from './isoGeometry'

interface Shape {
  name: string
  /** 顺时针描绘正面（模型坐标 x、z），沿 y 轴挤出。 */
  profile: Pt[]
  depth: Pt
  face?: true
  stud?: true
}

interface PetFacet {
  kind: 'top' | 'side'
  points: Pt[]
  seam: [Pt, Pt]
}

interface PetStud {
  center: Pt
  rx: number
  ry: number
  height: number
}

interface PetFace {
  width: number
  height: number
}

export interface PetPart {
  name: string
  outline: Pt[]
  front: Pt[]
  facets: PetFacet[]
  face?: PetFace
  stud?: PetStud
}

interface PetGeometry {
  parts: PetPart[]
  ground: number
}

const { tileW, tileH, blockH } = DEFAULT_ISO_CONFIG
const FRONT_WIDTH = tileW / Math.SQRT2
const FRONT_PITCH = 1 / (2 * Math.SQRT2)
const EDGE_EPSILON = 1e-8

function brick(name: string, width: Pt, depth: Pt, height: Pt, face?: true, stud?: true): Shape {
  const [left, right] = width
  const [bottom, top] = height
  return {
    name,
    profile: [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom]
    ],
    depth,
    face,
    stud
  }
}

const BLOCK_BODY = brick('body', [-0.5, 0.5], [-0.5, 0.5], [0, 1], true, true)

const cross = (origin: Pt, a: Pt, b: Pt): number =>
  (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])

function halfOutline(sorted: Pt[]): Pt[] {
  const outline: Pt[] = []
  for (const point of sorted) {
    while (
      outline.length >= 2 &&
      cross(outline[outline.length - 2], outline[outline.length - 1], point) <= 0
    ) {
      outline.pop()
    }
    outline.push(point)
  }
  return outline.slice(0, -1)
}

function outlineOf(points: Pt[]): Pt[] {
  const sorted = [...points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by)
  return [...halfOutline(sorted), ...halfOutline([...sorted].reverse())]
}

type Project = (x: number, y: number, z: number) => Pt

function buildPart(shape: Shape, project: Project, pitch: number): PetPart {
  const { name, profile, depth } = shape
  const front = profile.map(([x, z]) => project(x, depth[1], z))
  const back = profile.map(([x, z]) => project(x, depth[0], z))
  const facets = profile.flatMap(([x], i): PetFacet[] => {
    const next = (i + 1) % profile.length
    // 零面积或反面不可见；正视时两侧恰好收成零面积。
    if (cross(back[i], back[next], front[next]) <= EDGE_EPSILON) return []
    return [
      {
        kind: x === profile[next][0] ? 'side' : 'top',
        points: [back[i], back[next], front[next], front[i]],
        seam: [front[i], front[next]]
      }
    ]
  })

  const width = profile[1][0] - profile[0][0]
  const face = shape.face
    ? { width: width * FRONT_WIDTH, height: (profile[0][1] - profile[3][1]) * blockH }
    : undefined
  const studSize = Math.min(width, depth[1] - depth[0])
  const stud = shape.stud
    ? {
        center: project(
          (profile[0][0] + profile[1][0]) / 2,
          (depth[0] + depth[1]) / 2,
          profile[0][1]
        ),
        rx: tileW * 0.25 * studSize,
        ry: tileH * 0.25 * studSize * pitch,
        height: STUD_H * studSize
      }
    : undefined
  return { name, outline: outlineOf([...front, ...back]), front, facets, face, stud }
}

/** turn ∈ [-1, 1]；峰值精确落在建造页的等距基底，正视只浅俯视。 */
export function projectPet(turn: number): PetGeometry {
  const yaw = (-turn * Math.PI) / 4
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  const pitch = FRONT_PITCH + (1 - FRONT_PITCH) * Math.abs(turn)
  const parts = [BLOCK_BODY].map((shape) =>
    buildPart(
      shape,
      (x, y, z) => {
        const across = (x * cos - y * sin) / Math.SQRT2
        const away = ((x * sin + y * cos) / Math.SQRT2) * pitch
        const { sx, sy } = worldToScreen(away + across, away - across, z, DEFAULT_ISO_CONFIG)
        return [sx, sy]
      },
      pitch
    )
  )
  return { parts, ground: Math.max(...parts.flatMap((part) => part.outline.map(([, y]) => y))) }
}
