import { api } from "./api"

export interface AuthUser {
  id: string
  email: string
  createdAt: string
}

export const authService = {
  getToken(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem("access_token")
  },

  setToken(token: string) {
    if (typeof window === "undefined") return
    localStorage.setItem("access_token", token)
  },

  async getMe(): Promise<AuthUser> {
    return api.get("/auth/me")
  },

  async signOut() {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const data: any = await api.post("/auth/signin", { email, password })
    if (data && data.access_token) {
      this.setToken(data.access_token)
    }
    return this.getMe()
  },

  async signUp(email: string, password: string): Promise<AuthUser> {
    await api.post("/auth/signup", { email, password })
    return this.signIn(email, password)
  },
}
