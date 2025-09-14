import React, { useState, useEffect } from 'react'
import { useRole } from '../contexts/RoleContext'
import { supabase } from '../lib/supabase'
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  FileText, 
  Wrench, 
  DollarSign,
  Shield,
  BarChart3,
  Calendar,
  Bell,
  Upload,
  RefreshCw
} from 'lucide-react'

interface DashboardCard {
  card_type: string
  title: string
  content: any
  priority: number
  document_count: number
  urgent_count: number
}

interface DashboardData {
  totalDocuments: number
  urgentItems: number
  recentActivity: any[]
  cards: DashboardCard[]
}

const ROLE_CONFIGS = {
  STATION_CTRL: {
    title: 'Station Control Dashboard',
    icon: AlertTriangle,
    color: 'bg-red-500',
    cards: [
      { type: 'incidents', title: 'Active Incidents', icon: AlertTriangle },
      { type: 'safety', title: 'Safety Alerts', icon: Shield },
      { type: 'operations', title: 'Train Status', icon: Clock },
      { type: 'protocols', title: 'Emergency Protocols', icon: FileText }
    ]
  },
  ROLLING_STOCK: {
    title: 'Rolling Stock & Engineering',
    icon: Wrench,
    color: 'bg-blue-500',
    cards: [
      { type: 'maintenance', title: 'Maintenance Jobs', icon: Wrench },
      { type: 'alerts', title: 'System Alerts', icon: Bell },
      { type: 'design', title: 'Design Changes', icon: FileText },
      { type: 'parts', title: 'Spare Parts', icon: TrendingUp }
    ]
  },
  PROCUREMENT: {
    title: 'Procurement & Finance',
    icon: DollarSign,
    color: 'bg-green-500',
    cards: [
      { type: 'invoices', title: 'Pending Invoices', icon: DollarSign },
      { type: 'contracts', title: 'Contract Alerts', icon: FileText },
      { type: 'budget', title: 'Budget Status', icon: BarChart3 },
      { type: 'audit', title: 'Audit Trail', icon: CheckCircle }
    ]
  },
  HR: {
    title: 'Human Resources',
    icon: Users,
    color: 'bg-purple-500',
    cards: [
      { type: 'training', title: 'Training Schedule', icon: Calendar },
      { type: 'policies', title: 'Policy Updates', icon: FileText },
      { type: 'staff', title: 'Staff Allocation', icon: Users },
      { type: 'attendance', title: 'Attendance', icon: CheckCircle }
    ]
  },
  SAFETY: {
    title: 'Safety & Compliance',
    icon: Shield,
    color: 'bg-orange-500',
    cards: [
      { type: 'regulatory', title: 'Regulatory Directives', icon: Shield },
      { type: 'circulars', title: 'Safety Circulars', icon: Bell },
      { type: 'audit', title: 'Audit Findings', icon: FileText },
      { type: 'compliance', title: 'Compliance Status', icon: CheckCircle }
    ]
  },
  EXECUTIVE: {
    title: 'Executive Dashboard',
    icon: BarChart3,
    color: 'bg-indigo-500',
    cards: [
      { type: 'overview', title: 'Metro Overview', icon: BarChart3 },
      { type: 'risks', title: 'Risk Dashboard', icon: AlertTriangle },
      { type: 'compliance', title: 'Compliance Status', icon: Shield },
      { type: 'projects', title: 'Strategic Projects', icon: TrendingUp }
    ]
  }
}

export function RoleDashboard() {
  const { currentRole, userRoles, setCurrentRole } = useRole()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (currentRole) {
      fetchDashboardData()
    }
  }, [currentRole])

  const fetchDashboardData = async () => {
    if (!currentRole) return

    try {
      setLoading(true)
      
      // Get dashboard cards data
      const { data: cardsData, error: cardsError } = await supabase
        .rpc('get_dashboard_data', { role_code_param: currentRole.role_code })

      if (cardsError) throw cardsError

      // Get recent documents for this role
      const { data: documentsData, error: docsError } = await supabase
        .from('documents')
        .select(`
          id, title, created_at, deadline, severity_level, status,
          document_categories (category_name, color_code)
        `)
        .contains('document_categories.target_roles', [currentRole.role_code])
        .order('created_at', { ascending: false })
        .limit(10)

      if (docsError) throw docsError

      // Calculate summary stats
      const totalDocuments = documentsData?.length || 0
      const urgentItems = documentsData?.filter(doc => 
        doc.deadline && new Date(doc.deadline) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ).length || 0

      setDashboardData({
        totalDocuments,
        urgentItems,
        recentActivity: documentsData || [],
        cards: cardsData || []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  const isUrgent = (deadline: string | null) => {
    if (!deadline) return false
    const deadlineDate = new Date(deadline)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    return deadlineDate <= sevenDaysFromNow
  }

  if (!currentRole) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-2">No Role Assigned</h2>
          <p className="text-gray-600 dark:text-gray-400">Please contact your administrator to assign a role.</p>
        </div>
      </div>
    )
  }

  const roleConfig = ROLE_CONFIGS[currentRole.role_code as keyof typeof ROLE_CONFIGS]
  const RoleIcon = roleConfig?.icon || BarChart3

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-dark-card shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${roleConfig?.color || 'bg-gray-500'}`}>
                <RoleIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-dark-text">
                  {roleConfig?.title || currentRole.role_name}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Metro Operations Dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Role Switcher */}
              {userRoles.length > 1 && (
                <select
                  value={currentRole.role_code}
                  onChange={(e) => {
                    const role = userRoles.find(r => r.role_code === e.target.value)
                    if (role) setCurrentRole(role)
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-search text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary"
                >
                  {userRoles.map(role => (
                    <option key={role.role_code} value={role.role_code}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-md hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-accent-primary"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-300">Loading dashboard...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                <div className="flex items-center">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-accent-primary" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Documents</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                      {dashboardData?.totalDocuments || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-accent-warning" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Urgent Items</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-accent-warning">
                      {dashboardData?.urgentItems || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                      {dashboardData?.recentActivity.filter(doc => 
                        new Date(doc.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-green-600 dark:text-accent-success" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Status</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-accent-success">
                      {dashboardData?.recentActivity.filter(doc => doc.status === 'active').length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Role-Specific Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {roleConfig?.cards.map((cardConfig, index) => {
                const CardIcon = cardConfig.icon
                const cardData = dashboardData?.cards.find(c => c.card_type === cardConfig.type)
                
                return (
                  <div
                    key={cardConfig.type}
                    className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <CardIcon className="w-6 h-6 text-blue-600 dark:text-accent-primary" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                          {cardConfig.title}
                        </h3>
                      </div>
                      {cardData && cardData.urgent_count > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                          {cardData.urgent_count} urgent
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Items</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-dark-text">
                          {cardData?.document_count || 0}
                        </span>
                      </div>
                      
                      {cardData && cardData.urgent_count > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-red-600 dark:text-red-400">Due Soon</span>
                          <span className="text-lg font-bold text-red-600 dark:text-red-400">
                            {cardData.urgent_count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Recent Activity</h3>
              </div>
              <div className="p-6">
                {dashboardData?.recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No recent documents for your role</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData?.recentActivity.slice(0, 5).map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          isUrgent(doc.deadline)
                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-search'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            doc.severity_level >= 4 ? 'bg-red-500' :
                            doc.severity_level >= 3 ? 'bg-orange-500' :
                            'bg-green-500'
                          }`} />
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-dark-text">{doc.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(doc.created_at).toLocaleDateString()}
                              {doc.deadline && (
                                <span className={`ml-2 ${isUrgent(doc.deadline) ? 'text-red-600 dark:text-red-400' : ''}`}>
                                  • Due: {new Date(doc.deadline).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {isUrgent(doc.deadline) && (
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}