import { api } from "./api"

export interface Share {
  id: string
  itemId: string
  itemType: "file" | "folder"
  ownerId: string
  sharedWithId: string
  permission: "view" | "edit"
  createdAt: string
  owner?: {
    email: string
  }
  sharedWith?: {
    email: string
  }
  item?: {
    name: string
  }
}

export const sharingService = {
  async createShare(itemId: string, itemType: "file" | "folder", email: string, permission: "view" | "edit") {
    return api.post("/shares", {
      itemId,
      itemType,
      email,
      permission,
    })
  },

  async getSharedWithMe(): Promise<Share[]> {
    return api.get("/shares/shared-with-me")
  },

  async getSent(): Promise<Share[]> {
    return api.get("/shares/sent")
  },

  async deleteShare(id: string) {
    return api.delete(`/shares/${id}`)
  },
}
