import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { listVehicleTypes } from '../api/vehicleTypes'
import { listGarages } from '../api/garages'
import { listSpots } from '../api/spots'
import type { VehicleType } from '../api/vehicleTypes'
import type { Garage } from '../api/garages'
import type { Spot } from '../api/spots'

export interface VehicleEntryFormShape {
  garage_id: number | null
  spot_id: number | null
}

/**
 * Dropdown data and garage → free-spot loading for the new vehicle entry flow.
 */
export function useVehicleEntryOptions(
  _form: VehicleEntryFormShape,
  setForm: Dispatch<SetStateAction<VehicleEntryFormShape>>,
) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [garages, setGarages] = useState<Garage[]>([])
  const [freeSpots, setFreeSpots] = useState<Spot[]>([])
  const [optionsError, setOptionsError] = useState('')

  const vehicleTypeOptions = useMemo(
    () => vehicleTypes.map((vt) => ({ id: vt.id, label: vt.type })),
    [vehicleTypes],
  )
  const garageOptions = useMemo(
    () => garages.map((g) => ({ id: g.id, label: g.name })),
    [garages],
  )
  const spotOptions = useMemo(
    () => freeSpots.map((s) => ({ id: s.id, label: s.code })),
    [freeSpots],
  )

  const loadVehicleTypesAndGarages = useCallback(async () => {
    try {
      const [vtRes, gRes] = await Promise.all([
        listVehicleTypes({ limit: 100 }),
        listGarages({ limit: 100 }),
      ])
      setVehicleTypes(vtRes.data.items)
      setGarages(gRes.data.items)
    } catch {
      setOptionsError('Failed to load options')
    }
  }, [])

  const loadFreeSpotsForGarage = useCallback(async (garageId: number | null) => {
    if (!garageId) {
      setFreeSpots([])
      return
    }
    try {
      const res = await listSpots({
        garage_id: garageId,
        only_free: true,
        active_only: true,
        limit: 500,
      })
      setFreeSpots(res.data.items)
    } catch {
      setFreeSpots([])
    }
  }, [])

  const onGarageSelect = useCallback(
    (value: number | null) => {
      const garage_id = value ?? null
      setForm((prev) => ({ ...prev, garage_id, spot_id: null }))
      void loadFreeSpotsForGarage(garage_id)
    },
    [setForm, loadFreeSpotsForGarage],
  )

  const resetSpots = useCallback(() => {
    setFreeSpots([])
  }, [])

  return {
    vehicleTypes,
    garages,
    freeSpots,
    optionsError,
    setOptionsError,
    vehicleTypeOptions,
    garageOptions,
    spotOptions,
    loadVehicleTypesAndGarages,
    loadFreeSpotsForGarage,
    onGarageSelect,
    resetSpots,
  }
}
