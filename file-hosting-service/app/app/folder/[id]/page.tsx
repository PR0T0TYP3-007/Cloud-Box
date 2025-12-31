"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
import { FileTable } from "@/components/file-table"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderPlus, Upload, Loader2, ChevronLeft } from "lucide-react"
import { foldersService, type FolderContents, type Folder, type File } from "@/services/folders.service"
import { filesService } from "@/services/files.service"
import { useRouter } from "next/navigation"
import { ShareDialog } from "@/components/share-dialog"

export default function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const folderId = resolvedParams.id
  const router = useRouter()

  const [contents, setContents] = useState<FolderContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])

  // Create folder dialog
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Rename dialog
  const [showRename, setShowRename] = useState(false)
  const [renameItem, setRenameItem] = useState<{ item: Folder | File; type: "folder" | "file" } | null>(null)
  const [newName, setNewName] = useState("")

  // Share dialog
  const [showShare, setShowShare] = useState(false)
  const [shareItem, setShareItem] = useState<{ item: Folder | File; type: "folder" | "file" } | null>(null)

  const loadContents = async () => {
    try {
      setLoading(true)
      const data = await foldersService.getContents(folderId)
      setContents(data)

      // Build breadcrumbs
      if (data.folder) {
        const crumbs: BreadcrumbItem[] = [
          {
            id: data.folder.id,
            name: data.folder.name,
            href: `/app/folder/${data.folder.id}`,
          },
        ]
        setBreadcrumbs(crumbs)
      }
    } catch (error) {
      console.error("Failed to load contents:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContents()
  }, [folderId])

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return

    try {
      setCreatingFolder(true)
      await foldersService.createFolder(folderName, folderId)
      setShowCreateFolder(false)
      setFolderName("")
      loadContents()
    } catch (error) {
      console.error("Failed to create folder:", error)
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      await Promise.all(Array.from(files).map((file) => filesService.uploadFile(file, folderId)))
      loadContents()
    } catch (error) {
      console.error("Failed to upload files:", error)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleRename = async () => {
    if (!renameItem || !newName.trim()) return

    try {
      if (renameItem.type === "folder") {
        await foldersService.renameFolder(renameItem.item.id, newName)
      } else {
        await filesService.renameFile(renameItem.item.id, newName)
      }
      setShowRename(false)
      setRenameItem(null)
      setNewName("")
      loadContents()
    } catch (error) {
      console.error("Failed to rename:", error)
    }
  }

  const openRenameDialog = (item: Folder | File, type: "folder" | "file") => {
    setRenameItem({ item, type })
    setNewName(item.name)
    setShowRename(true)
  }

  const openShareDialog = (item: Folder | File, type: "folder" | "file") => {
    setShareItem({ item, type })
    setShowShare(true)
  }

  const handleBack = () => {
    if (contents?.folder?.parentId) {
      router.push(`/app/folder/${contents.folder.parentId}`)
    } else {
      router.push("/app")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Breadcrumbs items={breadcrumbs} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{contents?.folder?.name || "Folder"}</h1>
          <p className="text-muted-foreground mt-1">
            {contents?.folders.length || 0} folders, {contents?.files.length || 0} files
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
          <Button disabled={uploading} onClick={() => document.getElementById("file-upload")?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Files
          </Button>
          <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {contents && (
        <FileTable
          folders={contents.folders}
          files={contents.files}
          onRefresh={loadContents}
          onRename={openRenameDialog}
          onShare={openShareDialog}
        />
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for your new folder</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="My Documents"
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)} disabled={creatingFolder}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={creatingFolder || !folderName.trim()}>
              {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameItem?.type === "folder" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>Enter a new name</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <ShareDialog open={showShare} onOpenChange={setShowShare} item={shareItem} onSuccess={loadContents} />
    </div>
  )
}
