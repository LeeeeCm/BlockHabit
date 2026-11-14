import { HabitDialog } from '../../components/HabitDialog'
import { BlockDropModal } from '../../components/BlockDropModal'
import type { Blueprint, Habit } from '../../types'
import type { DropModalState, TodayToast } from './todayUtils'

interface Props {
  dialogOpen: boolean
  editing: Habit | null
  toast: TodayToast | null
  blueprint: Blueprint
  dropModal: DropModalState | null
  onCloseDialog: () => void
  onEngraved: () => void
  onCloseDropModal: () => void
}

/** 今日页浮层：习惯编辑对话框 / 全局 toast / 积木掉落弹窗。 */
export function TodayOverlays({
  dialogOpen,
  editing,
  toast,
  blueprint,
  dropModal,
  onCloseDialog,
  onEngraved,
  onCloseDropModal
}: Props) {
  return (
    <>
      {dialogOpen && <HabitDialog habit={editing ?? undefined} onClose={onCloseDialog} />}
      {toast && (
        <div className="toast">
          {toast.accent ? <span className="accent">◆ </span> : null}
          {toast.text}
        </div>
      )}
      {dropModal && (
        <BlockDropModal
          blueprint={blueprint}
          placedCount={dropModal.placedCount}
          habitName={dropModal.habitName}
          complete={dropModal.complete}
          checkInId={dropModal.checkInId}
          onEngraved={onEngraved}
          onClose={onCloseDropModal}
        />
      )}
    </>
  )
}
