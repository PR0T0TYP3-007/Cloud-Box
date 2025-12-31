import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Cloud, Shield, Users, Zap, FolderOpen, Share2 } from "lucide-react"
import Image from "next/image"
import dynamic from "next/dynamic"
const ApiStatus = dynamic(() => import("@/components/api-status"), { ssr: false })

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">CloudDrive</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container px-4 md:px-6 py-20 md:py-32 relative">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-300/20 dark:bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-300/20 dark:bg-blue-500/10 rounded-full blur-3xl" />

        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left relative z-10">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-6">
                Your files, accessible anywhere
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground text-balance mb-8">
                Store, share, and collaborate on files and folders from any device. CloudDrive keeps your work safe and
                accessible.
              </p>
              <div className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                  >
                    Get started free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                    Sign in
                  </Button>
                </Link>
              </div>

              {/* API status check (dev) */}
              <div className="mt-6 text-center">
                <ApiStatus />
              </div>
            </div>

            <div className="relative lg:block hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
                <Image
                  src="/modern-file-management-dashboard-interface-with-fo.jpg"
                  alt="CloudDrive Dashboard"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 md:px-6 py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/30 to-background" />

        <div className="mx-auto max-w-5xl relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-balance mb-12">
            Everything you need to stay productive
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FolderOpen className="h-8 w-8 text-primary" />}
              title="Organized storage"
              description="Keep your files organized with folders and easy navigation. Find what you need, when you need it."
            />
            <FeatureCard
              icon={<Share2 className="h-8 w-8 text-primary" />}
              title="Easy sharing"
              description="Share files and folders with anyone. Control who can view or edit your content."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-primary" />}
              title="Secure & private"
              description="Your files are encrypted and protected. We take your privacy seriously."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-primary" />}
              title="Lightning fast"
              description="Upload and access your files in seconds. Our infrastructure is built for speed."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Collaborate"
              description="Work together with your team. Share folders and manage permissions easily."
            />
            <FeatureCard
              icon={<Cloud className="h-8 w-8 text-primary" />}
              title="Cloud powered"
              description="Access your files from any device, anywhere. Your content is always in sync."
            />
          </div>
        </div>
      </section>

      <section className="container px-4 md:px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-border/50">
                <Image
                  src="/team-collaboration-file-sharing-interface-with-mul.jpg"
                  alt="Team Collaboration"
                  width={700}
                  height={500}
                  className="w-full h-auto"
                />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">Built for teams of all sizes</h2>
              <p className="text-lg text-muted-foreground text-balance mb-6">
                Whether you're working solo or with a team of hundreds, CloudDrive scales with your needs. Share files,
                manage permissions, and collaborate in real-time.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Advanced permission controls</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Real-time collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Lightning-fast file transfers</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 md:px-6 py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5" />

        <div className="mx-auto max-w-3xl text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground text-balance mb-8">
            Join thousands of users who trust CloudDrive with their important files.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            >
              Create your account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">© 2025 CloudDrive. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg border border-border hover:border-primary/20 transition-all hover:shadow-lg group">
      <div className="mb-4 p-3 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 group-hover:from-purple-500/20 group-hover:to-blue-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
