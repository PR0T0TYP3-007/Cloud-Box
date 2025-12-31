import { api } from "./api"

export const filesService = {
  async uploadFile(file: File, folderId?: string) {
    const formData = new FormData()
    formData.append("file", file)
    if (folderId) {
      formData.append("folderId", folderId)
    }
    return api.upload("/files/upload", formData)
  },

  async uploadMultiple(files: File[], paths: string[]) {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    formData.append("paths", JSON.stringify(paths))
    return api.upload("/files/upload-multi", formData)
  },

  async downloadFile(id: string) {
    const response = await api.download(`/files/${id}/download`)
    return response.blob()
  },

  async renameFile(id: string, name: string) {
    return api.patch(`/files/${id}/rename`, { name })
  },

  async moveFile(id: string, targetFolderId?: string) {
    return api.post(`/files/${id}/move`, { targetFolderId })
  },

  async deleteFile(id: string) {
    return api.delete(`/files/${id}`)
  },
}
