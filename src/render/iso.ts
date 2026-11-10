/**
 * 等距渲染对外入口（barrel）。
 *
 * E4：内部按职责拆为四个模块，这里统一再导出，**所有既有 `from './iso'` 导入保持不变**：
- ./isoGeometry —— 投影数学与几何原语
- ./isoColor —— 调色板、颜色派生、对比度、时段环境光
- ./isoCube —— 积木绘制、精灵缓存、命中检测
- ./isoGround —— 地基、接触阴影、植被
 */
export * from './isoGeometry'
export * from './isoColor'
export * from './isoCube'
export * from './isoGround'
