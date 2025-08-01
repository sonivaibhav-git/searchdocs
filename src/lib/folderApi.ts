import { supabase } from './supabase'

export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id?: string
  document_count: number
  created_at: string
  updated_at: string
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
}

export class FolderAPI {
  // Get folder tree for current user
  static async getFolderTree(): Promise<FolderTreeNode[]> {
    try {
      // For now, return empty array until migrations are applied
      return []
    } catch (error) {
      console.error('Error fetching folder tree:', error)
      return []
    }
  }

  // Create new folder
  static async createFolder(
    folderName: string, 
    parentFolderId?: string
  ): Promise<Folder> {
    throw new Error('Folder creation not available until database migrations are applied')
  }

  // Update folder name
  static async updateFolder(folderId: string, folderName: string): Promise<Folder> {
    throw new Error('Folder updates not available until database migrations are applied')
  }

  // Delete folder (only if empty)
  static async deleteFolder(folderId: string): Promise<void> {
    throw new Error('Folder deletion not available until database migrations are applied')
  }

  // Move document to folder
  static async moveDocumentToFolder(documentId: string, folderId?: string): Promise<void> {
    throw new Error('Document moving not available until database migrations are applied')
  }

  // Move multiple documents to folder
  static async moveDocumentsToFolder(documentIds: string[], folderId?: string): Promise<void> {
    throw new Error('Bulk document moving not available until database migrations are applied')
  }

  // Get documents in folder
  static async getDocumentsInFolder(_folderId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get all documents for now (ignore folder filtering until migrations are applied)
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching documents:', error)
      return []
    }
  }

  // Search documents across all folders
  static async searchDocuments(searchQuery: string, _folderId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Search all documents for now (ignore folder filtering until migrations are applied)
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          user_profiles (
            user_id,
            username,
            display_name
          )
        `)
        .eq('user_id', user.id)
        .textSearch('content', searchQuery, {
          type: 'websearch',
          config: 'english'
        })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching documents:', error)
      return []
    }
  }
}