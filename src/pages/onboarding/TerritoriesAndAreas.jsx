import { useEffect, useMemo, useState } from 'react'
import { Check, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { generateId } from '@/lib/onboardingSetup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NativeSelect } from './onboarding-ui'

const NEW_AREA_ID = '__new_area__'

const regionOptions = ['Region XIII (Caraga)']
const provinceOptions = [
  'Surigao del Norte',
  'Dinagat Islands',
  'Agusan del Norte',
  'Agusan del Sur',
  'Surigao del Sur',
]
const cityOptions = [
  'Surigao City',
  'General Luna',
  'Dapa',
  'Del Carmen',
  'Socorro',
  'San Isidro',
  'Santa Monica',
  'Burgos',
  'Pilar',
]

function territoryLocationLabel(territory) {
  return `${territory.city}, ${territory.province} • ${territory.region}`
}

export function TerritoriesAndAreas({ onSelectionChange } = {}) {
  const [territories, setTerritories] = useState(() => [
    {
      id: 'territory_surigaocity_01',
      coverageName: 'Surigao City Hub 01',
      region: 'Region XIII (Caraga)',
      province: 'Surigao del Norte',
      city: 'Surigao City',
    },
    {
      id: 'territory_siargao_gl_01',
      coverageName: 'Siargao – General Luna Hub 01',
      region: 'Region XIII (Caraga)',
      province: 'Surigao del Norte',
      city: 'General Luna',
    },
  ])
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(
    'territory_surigaocity_01',
  )
  const [areas, setAreas] = useState(() => [
    {
      id: 'area_surigaocity_1',
      territoryId: 'territory_surigaocity_01',
      name: 'Barangay Taft, Surigao City',
    },
    {
      id: 'area_surigaocity_2',
      territoryId: 'territory_surigaocity_01',
      name: 'Barangay Washington, Surigao City',
    },
    {
      id: 'area_gl_1',
      territoryId: 'territory_siargao_gl_01',
      name: 'Barangay Catangnan, General Luna',
    },
    {
      id: 'area_gl_2',
      territoryId: 'territory_siargao_gl_01',
      name: 'Barangay Poblacion 1, General Luna',
    },
  ])
  const [editingAreaId, setEditingAreaId] = useState(null)
  const [draftArea, setDraftArea] = useState(null)

  const selectedTerritory = useMemo(
    () =>
      territories.find((item) => item.id === selectedTerritoryId) ??
      territories[0],
    [selectedTerritoryId, territories],
  )
  const selectedAreas = useMemo(
    () => areas.filter((area) => area.territoryId === selectedTerritory?.id),
    [areas, selectedTerritory?.id],
  )
  const areaCountByTerritory = useMemo(() => {
    const map = new Map()
    areas.forEach((area) => {
      map.set(area.territoryId, (map.get(area.territoryId) ?? 0) + 1)
    })
    return map
  }, [areas])
  const isEditingArea = editingAreaId !== null

  useEffect(() => {
    onSelectionChange?.({
      territory: selectedTerritory ?? null,
      areas: selectedAreas,
      areasCount: selectedAreas.length,
      territoriesCount: territories.length,
    })
  }, [
    onSelectionChange,
    selectedTerritory,
    selectedAreas.length,
    territories.length,
  ])

  const addTerritory = () => {
    const id = generateId('territory')
    const base = selectedTerritory ?? {
      region: regionOptions[0],
      province: provinceOptions[0],
      city: cityOptions[0],
    }
    setTerritories((prev) => [
      ...prev,
      {
        id,
        coverageName: `New Territory ${prev.length + 1}`,
        region: base.region,
        province: base.province,
        city: base.city,
      },
    ])
    setSelectedTerritoryId(id)
  }

  const deleteTerritory = () => {
    const territory = selectedTerritory
    if (!territory || territories.length <= 1) return
    if (
      !window.confirm(
        `Delete territory "${territory.coverageName}" and its areas?`,
      )
    ) {
      return
    }
    const remaining = territories.filter((item) => item.id !== territory.id)
    setTerritories(remaining)
    setAreas((prev) => prev.filter((area) => area.territoryId !== territory.id))
    setSelectedTerritoryId(remaining[0]?.id ?? '')
  }

  const updateTerritory = (patch) => {
    if (!selectedTerritory) return
    setTerritories((prev) =>
      prev.map((item) =>
        item.id === selectedTerritory.id ? { ...item, ...patch } : item,
      ),
    )
  }

  const startAddArea = () => {
    if (!selectedTerritory) return
    setEditingAreaId(NEW_AREA_ID)
    setDraftArea({ name: '' })
  }

  const startEditArea = (area) => {
    setEditingAreaId(area.id)
    setDraftArea({ name: area.name })
  }

  const cancelAreaEdit = () => {
    setEditingAreaId(null)
    setDraftArea(null)
  }

  const saveAreaEdit = () => {
    if (!editingAreaId || !draftArea || !selectedTerritory) return
    const trimmed = draftArea.name.trim()
    if (!trimmed) return
    if (editingAreaId === NEW_AREA_ID) {
      setAreas((prev) => [
        ...prev,
        {
          id: generateId('area'),
          territoryId: selectedTerritory.id,
          name: trimmed,
        },
      ])
      cancelAreaEdit()
      return
    }
    setAreas((prev) =>
      prev.map((area) =>
        area.id === editingAreaId ? { ...area, name: trimmed } : area,
      ),
    )
    cancelAreaEdit()
  }

  const deleteArea = (areaId) => {
    const area = areas.find((item) => item.id === areaId)
    if (!area) return
    if (!window.confirm(`Delete "${area.name}"?`)) return
    setAreas((prev) => prev.filter((item) => item.id !== areaId))
    if (editingAreaId === areaId) cancelAreaEdit()
  }

  const territoryComplete = Boolean(
    selectedTerritory?.region &&
      selectedTerritory?.province &&
      selectedTerritory?.city,
  )

  return (
    <Card>
      <CardHeader className="space-y-4 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base">Territories & Areas</CardTitle>
          <CardDescription>
            Pick a territory (coverage group). Areas and geolocation settings
            are managed per territory.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm space-y-1.5">
            <Label htmlFor="selected-territory">Selected territory</Label>
            <NativeSelect
              id="selected-territory"
              value={selectedTerritoryId}
              onChange={(event) => setSelectedTerritoryId(event.target.value)}
              disabled={isEditingArea}
            >
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {`${territory.coverageName} (${areaCountByTerritory.get(territory.id) ?? 0} areas)`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTerritory}
              disabled={isEditingArea}
            >
              <Plus className="h-4 w-4" />
              Add Territory
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={deleteTerritory}
              disabled={territories.length <= 1 || isEditingArea}
            >
              <Trash2 className="h-4 w-4" />
              Delete Territory
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Territory Details
              </div>
              <div className="font-semibold">
                {selectedTerritory?.coverageName ?? ''}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedTerritory
                  ? territoryLocationLabel(selectedTerritory)
                  : ''}
              </div>
            </div>
            <Badge
              variant={territoryComplete ? 'success' : 'warning'}
              className="rounded-full"
            >
              {territoryComplete
                ? 'Territory available'
                : 'Incomplete territory'}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="territory-region">Region</Label>
              <NativeSelect
                id="territory-region"
                value={selectedTerritory?.region ?? ''}
                onChange={(event) =>
                  updateTerritory({ region: event.target.value })
                }
              >
                {regionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="territory-province">Province</Label>
              <NativeSelect
                id="territory-province"
                value={selectedTerritory?.province ?? ''}
                onChange={(event) =>
                  updateTerritory({ province: event.target.value })
                }
              >
                {provinceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="territory-city">City/Municipality</Label>
              <NativeSelect
                id="territory-city"
                value={selectedTerritory?.city ?? ''}
                onChange={(event) =>
                  updateTerritory({ city: event.target.value })
                }
              >
                {cityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="coverage-name">Coverage Name</Label>
              <Input
                id="coverage-name"
                value={selectedTerritory?.coverageName ?? ''}
                onChange={(event) =>
                  updateTerritory({ coverageName: event.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                New areas will be assigned to{' '}
                <span className="font-medium text-foreground">
                  {selectedTerritory?.coverageName ?? 'this territory'}
                </span>
                .
              </p>
            </div>
          </div>
          <div className="relative flex min-h-[220px] items-center justify-center border border-border bg-muted">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!selectedTerritory) return
                window.alert(
                  `Boundary editor placeholder. This would edit boundaries for "${selectedTerritory.coverageName}".`,
                )
              }}
            >
              <MapPin className="h-4 w-4" />
              Edit Boundaries
            </Button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border px-4 py-3">
              <div>
                <CardTitle className="text-base">Areas</CardTitle>
                <CardDescription>
                  {selectedAreas.length} included in{' '}
                  {selectedTerritory?.coverageName ?? 'this territory'}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startAddArea}
                disabled={isEditingArea || !selectedTerritory}
              >
                <Plus className="h-4 w-4" />
                Add Area
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead className="w-28 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editingAreaId === NEW_AREA_ID && draftArea ? (
                    <TableRow>
                      <TableCell>
                        <Input
                          autoFocus
                          placeholder="Area name (e.g., Barangay X, City)"
                          value={draftArea.name}
                          onChange={(event) =>
                            setDraftArea((draft) =>
                              draft
                                ? { ...draft, name: event.target.value }
                                : draft,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={saveAreaEdit}
                          aria-label="Save area"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={cancelAreaEdit}
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {selectedAreas.length === 0 &&
                  editingAreaId !== NEW_AREA_ID ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-sm text-muted-foreground"
                      >
                        No areas yet. Click Add Area to attach areas to this
                        territory.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {selectedAreas.map((area) => {
                    const rowIsEditing =
                      editingAreaId === area.id && draftArea
                    if (rowIsEditing) {
                      return (
                        <TableRow key={area.id}>
                          <TableCell>
                            <Input
                              autoFocus
                              value={draftArea.name}
                              onChange={(event) =>
                                setDraftArea((draft) =>
                                  draft
                                    ? { ...draft, name: event.target.value }
                                    : draft,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={saveAreaEdit}
                              aria-label={`Save ${area.name}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={cancelAreaEdit}
                              aria-label={`Cancel editing ${area.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    return (
                      <TableRow key={area.id}>
                        <TableCell className="font-medium">{area.name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditArea(area)}
                            disabled={isEditingArea}
                            aria-label={`Edit ${area.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteArea(area.id)}
                            disabled={isEditingArea}
                            aria-label={`Delete ${area.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
