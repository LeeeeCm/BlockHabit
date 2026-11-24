import type { TranslationSchema } from '../../i18n/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { RepairTarget } from './types'

interface Props {
  t: TranslationSchema
  target: RepairTarget
  repairBricks: number
  onCancel: () => void
  onConfirm: () => void
}

/** 补签二次确认（行为与拆分前一致：确认后不自动关闭弹窗） */
export function StatsRepairDialog({ t, target, repairBricks, onCancel, onConfirm }: Props) {
  return (
    <ConfirmDialog
      title={t.stats.repairDialogTitle}
      message={t.stats.repairDialogMsg(target.habitName, target.date, repairBricks)}
      confirmLabel={t.common.confirm}
      cancelLabel={t.common.cancel}
      danger={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
