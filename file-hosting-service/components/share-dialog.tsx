"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { sharingService } from "@/services/sharing.service"
import type { Folder, File } from "@/services/folders.service"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: { item: Folder | File; type: "folder" | "file" } | null
  onSuccess?: () => void
}

export function ShareDialog({ open, onOpenChange, item, onSuccess }: ShareDialogProps) {
  const [email, setEmail] = useState("")
  const [permission, setPermission] = useState<"view" | "edit">("view")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleShare = async () => {
    if (!item || !email.trim()) return

    setError("")
    setLoading(true)

    try {
      await sharingService.createShare(item.item.id, item.type, email, permission)
      setSuccess(true)
      setEmail("")
      setPermission("view")
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
        onSuccess?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEmail("")
    setPermission("view")
    setError("")
    setSuccess(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {item?.type === "folder" ? "Folder" : "File"}</DialogTitle>
          <DialogDescription>Share "{item?.item.name}" with others</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium">Successfully shared!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permission">Permission</Label>
                <Select value={permission} onValueChange={(value) => setPermission(value as "view" | "edit")}>
                  <SelectTrigger id="permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Can view</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {permission === "view"
                    ? "User can only view and download"
                    : "User can view, download, edit, and delete"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={loading || !email.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Share
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
