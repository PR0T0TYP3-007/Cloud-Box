import Link from "next/link"
import { ChevronRight, HardDrive } from "lucide-react"

export interface BreadcrumbItem {
  id: string | null
  name: string
  href: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/app"
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <HardDrive className="h-4 w-4" />
        <span>My Drive</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={item.id || "root"} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{item.name}</span>
            ) : (
              <Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {item.name}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
