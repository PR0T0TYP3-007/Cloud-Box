"use client"

export default function TrashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Trash</h1>
        <p className="text-muted-foreground mt-1">Items in trash will be permanently deleted after 30 days</p>
      </div>

      <div className="border rounded-lg bg-card p-12 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-lg mb-2">Trash is empty</h3>
            <p className="text-sm text-muted-foreground">
              Deleted items will appear here and can be restored within 30 days
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
