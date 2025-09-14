import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export interface Role {
  role_code: string
  role_name: string
  permissions: Record<string, boolean>
}

interface RoleContextType {
  userRoles: Role[]
  currentRole: Role | null
  setCurrentRole: (role: Role) => void
  hasRole: (roleCode: string) => boolean
  hasPermission: (permission: string) => boolean
  loading: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [userRoles, setUserRoles] = useState<Role[]>([])
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchUserRoles()
    } else {
      setUserRoles([])
      setCurrentRole(null)
      setLoading(false)
    }
  }, [user?.id])

  const fetchUserRoles = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .rpc('get_user_roles', { user_uuid: user?.id })

      if (error) throw error

      const roles = data || []
      setUserRoles(roles)
      
      // Set default role (first role or Station Controllers if available)
      if (roles.length > 0) {
        const defaultRole = roles.find(r => r.role_code === 'STATION_CTRL') || roles[0]
        setCurrentRole(defaultRole)
      }
    } catch (error) {
      console.error('Error fetching user roles:', error)
      setUserRoles([])
      setCurrentRole(null)
    } finally {
      setLoading(false)
    }
  }

  const hasRole = (roleCode: string): boolean => {
    return userRoles.some(role => role.role_code === roleCode)
  }

  const hasPermission = (permission: string): boolean => {
    if (!currentRole) return false
    return currentRole.permissions[permission] === true
  }

  const value: RoleContextType = {
    userRoles,
    currentRole,
    setCurrentRole,
    hasRole,
    hasPermission,
    loading
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}