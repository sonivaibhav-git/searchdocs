import { supabase } from './supabase'

export interface Folder {
  folder_id: string
  user_id: string
  folder_name: string
  parent_folder_id?: string
  level: number
  document_count: number
  created_at: string
  updated_at: string
  has_children?: boolean
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  expanded: boolean
}

export class FolderAPI {
  // Get folder tree for current user
  static async getFolderTree(): Promise<FolderTreeNode[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.rpc('get_folder_tree', {
        user_uuid: user.id
      })

      if (error) throw error

      return this.buildFolderTree(data || [])
    } catch (error) {
      console.error('Error fetching folder tree:', error)
      throw error
    }
  }

  // Build hierarchical tree structure
  private static buildFolderTree(folders: Folder[]): FolderTreeNode[] {
    const folderMap = new Map<string, FolderTreeNode>()
    const rootFolders: FolderTreeNode[] = []

    // Create folder nodes
    folders.forEach(folder => {
      folderMap.set(folder.folder_id, {
        ...folder,
        children: [],
        expanded: false
      })
    })

    // Build hierarchy
    folders.forEach(folder => {
      const node = folderMap.get(folder.folder_id)!
      
      if (folder.parent_folder_id) {
        const parent = folderMap.get(folder.parent_folder_id)
        if (parent) {
          parent.children.push(node)
        }
      } else {
        rootFolders.push(node)
      }
    })

    return rootFolders.sort((a, b) => a.folder_name.localeCompare(b.folder_name))
  }

  // Create new folder
  static async createFolder(
    folderName: string, 
    parentFolderId?: string
  ): Promise<Folder> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Validate folder name
      const trimmedName = folderName.trim()
      if (trimmedName.length < 3 || trimmedName.length > 50) {
        throw new Error('Folder name must be between 3 and 50 characters')
      }

      if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(trimmedName)) {
        throw new Error('Folder name can only contain letters, numbers, spaces, hyphens, underscores, and periods')
      }

      // Check for duplicate names in same parent
      const { data: existingFolders, error: checkError } = await supabase
        .from('folders')
        .select('folder_id')
        .eq('user_id', user.id)
        .eq('folder_name', trimmedName)
        .eq('parent_folder_id', parentFolderId || null)
        .eq('is_deleted', false)

      if (checkError) throw checkError

      if (existingFolders && existingFolders.length > 0) {
        throw new Error('A folder with this name already exists in this location')
      }

      // Create folder
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: user.id,
          folder_name: trimmedName,
          parent_folder_id: parentFolderId || null
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  }

  // Update folder name
  static async updateFolder(folderId: string, folderName: string): Promise<Folder> {
    try {
      const trimmedName = folderName.trim()
      if (trimmedName.length < 3 || trimmedName.length > 50) {
        throw new Error('Folder name must be between 3 and 50 characters')
      }

      if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(trimmedName)) {
        throw new Error('Folder name can only contain letters, numbers, spaces, hyphens, underscores, and periods')
      }

      const { data, error } = await supabase
        .from('folders')
        .update({ folder_name: trimmedName })
        .eq('folder_id', folderId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating folder:', error)
      throw error
    }
  }

  // Delete folder (only if empty)
  static async deleteFolder(folderId: string): Promise<void> {
    try {
      // Check if folder can be deleted
      const { data: canDelete, error: checkError } = await supabase
        .rpc('can_delete_folder', { folder_uuid: folderId })

      if (checkError) throw checkError

      if (!canDelete) {
        throw new Error('Cannot delete folder: folder must be empty (no documents or subfolders)')
      }

      // Soft delete folder
      const { error } = await supabase
        .from('folders')
        .update({ is_deleted: true })
        .eq('folder_id', folderId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting folder:', error)
      throw error
    }
  }

  // Move document to folder
  static async moveDocumentToFolder(documentId: string, folderId?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ folder_id: folderId || null })
        .eq('id', documentId)

      if (error) throw error
    } catch (error) {
      console.error('Error moving document:', error)
      throw error
    }
  }

  // Move multiple documents to folder
  static async moveDocumentsToFolder(documentIds: string[], folderId?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ folder_id: folderId || null })
        .in('id', documentIds)

      if (error) throw error
    } catch (error) {
      console.error('Error moving documents:', error)
      throw error
    }
  }

  // Get documents in folder
  static async getDocumentsInFolder(folderId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      let query = supabase
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

      if (folderId) {
        query = query.eq('folder_id', folderId)
      } else {
        query = query.is('folder_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching documents:', error)
      throw error
    }
  }

  // Search documents across all folders
  static async searchDocuments(searchQuery: string, folderId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      let query = supabase
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

      if (folderId) {
        query = query.eq('folder_id', folderId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching documents:', error)
      throw error
    }
  }
}