import { api } from "./api"

export interface Folder {
  id: string
  name: string
  parentId: string | null
  userId: string
  createdAt: string
  updatedAt: string
}

export interface File {
  id: string
  name: string
  folderId: string | null
  userId: string
  storagePath: string
  size: number
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface FolderContents {
  parentName: string | null
  folder: Folder | null
  folders: Folder[]
  files: File[]
}

export const foldersService = {
  async getContents(folderId?: string): Promise<FolderContents> {
    const query = folderId ? `?folderId=${folderId}` : ""
    return api.get(`/folders${query}`)
  },

  async createFolder(name: string, parentId?: string) {
    return api.post("/folders", { name, parentId })
  },

  async renameFolder(id: string, name: string) {
    return api.patch(`/folders/${id}/rename`, { name })
  },

  async moveFolder(id: string, targetFolderId?: string) {
    return api.post(`/folders/${id}/move`, { targetFolderId })
  },

  async deleteFolder(id: string, recursive = false) {
    return api.delete(`/folders/${id}?recursive=${recursive}`)
  },
}
