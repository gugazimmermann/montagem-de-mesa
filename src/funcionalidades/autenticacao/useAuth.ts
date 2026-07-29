import { useContext } from 'react'
import { AuthContext, type AuthContextValor } from './auth-context'

export function useAuth(): AuthContextValor {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
