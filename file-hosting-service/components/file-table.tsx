"use client"
import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Folder,
  File,
  MoreVertical,
  Download,
  Trash2,
  Edit,
  Share2,
  FileText,
  ImageIcon,
  FileArchive,
  FileCode,
  Music,
  Video,
} from "lucide-react"
import type { Folder as FolderType, File as FileType } from "@/services/folders.service"
import { filesService } from "@/services/files.service"
import { foldersService } from "@/services/folders.service"
import { formatBytes, formatDate } from "@/utils/format"
import { useRouter } from "next/navigation"

interface FileTableProps {
  folders: FolderType[]
  files: FileType[]
  onRefresh: () => void
  onRename: (item: FolderType | FileType, type: "folder" | "file") => void
  onShare: (item: FolderType | FileType, type: "folder" | "file") => void
}

export function FileTable({ folders, files, onRefresh, onRename, onShare }: FileTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || "")) return ImageIcon
    if (["mp4", "mov", "avi", "mkv"].includes(ext || "")) return Video
    if (["mp3", "wav", "ogg"].includes(ext || "")) return Music
    if (["zip", "tar", "gz", "rar"].includes(ext || "")) return FileArchive
    if (["js", "jsx", "ts", "tsx", "py", "java", "cpp"].includes(ext || "")) return FileCode
    if (["txt", "md", "doc", "docx", "pdf"].includes(ext || "")) return FileText
    return File
  }

  const handleDownload = async (file: FileType) => {
    try {
      setLoadingId(file.id)
      const blob = await filesService.downloadFile(file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (item: FolderType | FileType, type: "folder" | "file") => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

    try {
      setLoadingId(item.id)
      if (type === "folder") {
        await foldersService.deleteFolder(item.id, true)
      } else {
        await filesService.deleteFile(item.id)
      }
      onRefresh()
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setLoadingId(null)
    }
  }

  const handleFolderClick = (folder: FolderType) => {
    router.push(`/app/folder/${folder.id}`)
  }

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">Name</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead>Size</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.length === 0 && files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                No files or folders yet. Upload something to get started!
              </TableCell>
            </TableRow>
          ) : (
            <>
              {folders.map((folder) => (
                <TableRow
                  key={folder.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onDoubleClick={() => handleFolderClick(folder)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5 text-primary" />
                      {folder.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(folder.updatedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loadingId === folder.id}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleFolderClick(folder)}>
                          <Folder className="mr-2 h-4 w-4" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRename(folder, "folder")}>
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onShare(folder, "folder")}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(folder, "folder")} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}

              {files.map((file) => {
                const FileIcon = getFileIcon(file.name)
                return (
                  <TableRow key={file.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        {file.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(file.updatedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatBytes(file.size)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loadingId === file.id}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRename(file, "file")}>
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShare(file, "file")}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(file, "file")} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
