import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as api from '../api.js'

const CaseContext = createContext(null)

const DEFAULT_ID = 'DEMO-001'
const DEFAULT_COUNSELOR = 'Vidhi Legal Review'

export function CaseProvider({ children }) {
  const [caseId] = useState(DEFAULT_ID)
  const [counselorName] = useState(DEFAULT_COUNSELOR)
  const [caseData, setCaseData] = useState(null)

  const refreshCase = useCallback(async () => {
    const d = await api.getCase(caseId)
    setCaseData(d)
    return d
  }, [caseId])

  const ensure = useCallback(async () => {
    await api.ensureCase(caseId, counselorName)
    return refreshCase()
  }, [caseId, counselorName, refreshCase])

  const value = useMemo(
    () => ({
      caseId,
      counselorName,
      caseData,
      setCaseData,
      refreshCase,
      ensure,
    }),
    [caseId, counselorName, caseData, refreshCase, ensure],
  )

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
}

export function useCase() {
  const ctx = useContext(CaseContext)
  if (!ctx) throw new Error('useCase outside CaseProvider')
  return ctx
}
