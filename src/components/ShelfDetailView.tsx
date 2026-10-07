import { useState } from 'react'
import type { ReactNode } from 'react'

// One visited shelf, scoped by ProfileBooks' household/profile key. Only a
// detail visit retains it; forms, backup, profile changes and logout release it.
export function ShelfDetailView({ page, renderShelf, children }: {
  page: 'shelf' | 'detail' | 'other';
  renderShelf: (active: boolean, animate: boolean) => ReactNode;
  children: ReactNode;
}) {
  const [session, setSession] = useState({ retained: false, visitedDetail: false })
  const active = page === 'shelf'
  const retained = active || page === 'detail' && session.retained
  const visitedDetail = retained && (session.visitedDetail || page === 'detail')
  // Derive during this render, before children commit: no one-frame remount on
  // Back and no eager hidden shelf when a detail is opened by a direct link.
  if (retained !== session.retained || visitedDetail !== session.visitedDetail)
    setSession({ retained, visitedDetail })
  return <>
    {retained && <div hidden={!active} inert={!active} aria-hidden={!active || undefined}>
      {renderShelf(active, !visitedDetail)}
    </div>}
    {!active && children}
  </>
}
