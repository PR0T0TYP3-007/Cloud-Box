"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Folder, File, Download, Loader2, FileText, ImageIcon, FileArchive, FileCode, Music, Video } from "lucide-react"
import { sharingService, type Share } from "@/services/sharing.service"
import { filesService } from "@/services/files.service"
import { formatDate } from "@/utils/format"
import { useRouter } from "next/navigation"

export default function SharedPage() {
  const router = useRouter()
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    loadShares()
  }, [])

  const loadShares = async () => {
    try {
      setLoading(true)
      const data = await sharingService.getSharedWithMe()
      setShares(data)
    } catch (error) {
      console.error("Failed to load shared items:", error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleDownload = async (share: Share) => {
    if (share.itemType !== "file") return

    try {
      setDownloadingId(share.id)
      const blob = await filesService.downloadFile(share.itemId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = share.item?.name || "file"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleOpen = (share: Share) => {
    if (share.itemType === "folder") {
      router.push(`/app/folder/${share.itemId}`)
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shared with me</h1>
        <p className="text-muted-foreground mt-1">Files and folders that others have shared with you</p>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead>Shared by</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead>Shared on</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shares.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No shared items yet
                </TableCell>
              </TableRow>
            ) : (
              shares.map((share) => {
                const Icon = share.itemType === "folder" ? Folder : getFileIcon(share.item?.name || "")
                const canDownload = share.itemType === "file"

                return (
                  <TableRow
                    key={share.id}
                    className={share.itemType === "folder" ? "cursor-pointer hover:bg-muted/50" : ""}
                    onDoubleClick={() => handleOpen(share)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-5 w-5 ${share.itemType === "folder" ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {share.item?.name || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{share.owner?.email || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={share.permission === "edit" ? "default" : "secondary"} className="capitalize">
                        {share.permission}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(share.createdAt)}</TableCell>
                    <TableCell>
                      {canDownload && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(share)}
                          disabled={downloadingId === share.id}
                        >
                          {downloadingId === share.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
