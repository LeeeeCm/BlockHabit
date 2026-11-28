/**
 * 输入法组合态判断（D-20261128-135）：
 * 中文/日文输入法在候选窗口按 Enter 确认时，Chromium/WebView2 仍会派发 keydown。
 * 只认 isComposing / keyCode 229，避免把“确认候选”误当成提交。
 */
export interface ImeKeyboardEventLike {
  isComposing?: boolean
  keyCode?: number
  nativeEvent?: {
    isComposing?: boolean
    keyCode?: number
  }
}

export function isImeComposing(event: ImeKeyboardEventLike): boolean {
  return (
    event.isComposing === true ||
    event.keyCode === 229 ||
    event.nativeEvent?.isComposing === true ||
    event.nativeEvent?.keyCode === 229
  )
}
