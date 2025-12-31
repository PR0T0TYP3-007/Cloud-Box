const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null

  const incomingHeaders: Record<string, string> = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : (options.headers as Record<string, string>) || {}

  const headers = {
    ...incomingHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
    throw new ApiError(401, "Unauthorized")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(response.status, data.message || "Request failed")
  }

  return response
}

export const api = {
  get: async (url: string) => {
    const response = await fetchWithAuth(url)
    return response.json()
  },

  post: async (url: string, body?: any) => {
    const response = await fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    return response.json()
  },

  patch: async (url: string, body?: any) => {
    const response = await fetchWithAuth(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    return response.json()
  },

  delete: async (url: string) => {
    const response = await fetchWithAuth(url, {
      method: "DELETE",
    })
    return response.json()
  },

  upload: async (url: string, formData: FormData) => {
    const response = await fetchWithAuth(url, {
      method: "POST",
      body: formData,
    })
    return response.json()
  },

  download: async (url: string) => {
    return fetchWithAuth(url)
  },
}
