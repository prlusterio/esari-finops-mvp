import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ONBOARDING_STEP_PATHS } from '@/lib/onboardingSetup'
import { formatCurrency } from '@/lib/currency'
import {
  fixedMonthlyTotal,
  formatUpdatedAt,
  getClientPortfolio,
  splitTotal,
  upfrontSetupTotal,
} from '@/lib/clientFinancials'
import { getHomePathForRole } from '@/lib/permissions'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function StatusBadge({ status }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-transparent px-2.5 py-1 font-medium',
        status === 'Activated' && 'bg-emerald-50 text-emerald-700',
        status === 'Pending Activation' && 'bg-amber-50 text-amber-700',
        status === 'Pending Review' && 'bg-sky-50 text-sky-700',
        status === 'In Progress' && 'bg-slate-100 text-slate-700',
      )}
    >
      {status}
    </Badge>
  )
}

export default function ClientsPage() {
  const { user } = useAuth()
  const clients = getClientPortfolio()

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Select a franchise or sub-franchise client to view setup details, financial history, and revenue split breakdown."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients' },
        ]}
        actions={
          <Button asChild>
            <Link to={ONBOARDING_STEP_PATHS[1]}>
              <Plus className="h-4 w-4" />
              Add New Client
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base">Client List</CardTitle>
          <CardDescription>
            Use View to open the dedicated client details page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Territories</TableHead>
                <TableHead className="text-right">Upfront Setup</TableHead>
                <TableHead className="text-right">Billable Monthly</TableHead>
                <TableHead className="text-right">Revenue Split</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((franchise) => (
                <TableRow key={franchise.id}>
                  <TableCell>
                    <div className="font-semibold">{franchise.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Updated {formatUpdatedAt(franchise.updatedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {franchise.clientType}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={franchise.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {franchise.territories.length}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(upfrontSetupTotal(franchise))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(fixedMonthlyTotal(franchise))}
                    <span className="text-sm text-muted-foreground"> / mo</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success">
                    {splitTotal(franchise)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm">
                      <Link to={`/franchise-setup/clients/${franchise.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
