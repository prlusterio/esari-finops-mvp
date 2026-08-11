import { Outlet } from 'react-router-dom'
import { Store } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">eSariSari</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Franchise financial operations platform
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
