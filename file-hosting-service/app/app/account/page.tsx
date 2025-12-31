"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HardDrive, User, LogOut, Loader2 } from "lucide-react"
import { authService, type AuthUser } from "@/services/auth.service"
import { formatDate } from "@/utils/format"

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      setLoading(true)
      const userData = await authService.getMe()
      setUser(userData)
    } catch (error) {
      console.error("Failed to load user:", error)
    } finally {
      setLoading(false)
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and storage</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your CloudBox account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="mt-1 font-medium">{user?.email}</p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Member since</label>
              <p className="mt-1 font-medium">{user?.createdAt ? formatDate(user.createdAt) : "Unknown"}</p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account ID</label>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{user?.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Storage Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Usage
            </CardTitle>
            <CardDescription>Your current storage allocation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">2.4 GB</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div className="h-full w-[16%] bg-primary rounded-full transition-all" />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>16% used</span>
                <span>15 GB total</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Files</span>
                <span className="font-medium">127</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Folders</span>
                <span className="font-medium">23</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shared items</span>
                <span className="font-medium">8</span>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4 bg-transparent" disabled>
              Upgrade Storage
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Manage your account and sign out</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start bg-transparent" disabled>
            Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive bg-transparent"
            disabled
          >
            Delete Account
          </Button>
          <Separator />
          <Button variant="destructive" className="w-full justify-start gap-2" onClick={() => authService.signOut()}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About CloudBox</CardTitle>
          <CardDescription>Version and information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>CloudBox Version 1.0.0</p>
          <p>Built with Next.js and NestJS</p>
          <p className="pt-2 text-xs">© 2025 CloudBox. All rights reserved.</p>
        </CardContent>
      </Card>
    </div>
  )
}
