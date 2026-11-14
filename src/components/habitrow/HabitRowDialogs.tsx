import type { TranslationSchema } from '../../i18n'
import { ConfirmDialog } from '../ConfirmDialog'

interface Props {
  t: TranslationSchema
  habitName: string
  confirmDelete: boolean
  showUndoConfirm: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelUndo: () => void
  onConfirmUndo: () => void
}

/** 卡片上的两个确认弹窗：删除习惯、撤销打卡。 */
export function HabitRowDialogs({
  t,
  habitName,
  confirmDelete,
  showUndoConfirm,
  onCancelDelete,
  onConfirmDelete,
  onCancelUndo,
  onConfirmUndo
}: Props) {
  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title={t.today.deleteConfirmTitle}
          message={t.today.deleteConfirmMsg(habitName)}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          danger
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      )}

      {showUndoConfirm && (
        <ConfirmDialog
          title={t.today.undoConfirmTitle}
          message={t.today.undoConfirmBody}
          confirmLabel={t.today.undoConfirmAction}
          cancelLabel={t.common.cancel}
          danger={false}
          onCancel={onCancelUndo}
          onConfirm={onConfirmUndo}
        />
      )}
    </>
  )
}
