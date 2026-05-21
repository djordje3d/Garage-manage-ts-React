import { getVehicleByPlate, createVehicle } from '../api/vehicles'
import { ticketEntry } from '../api/tickets'
import { uploadTicketImage } from '../api/upload'

export interface CreateParkingEntryParams {
  licencePlate: string
  vehicleTypeId: number
  garageId: number
  spotId: number | null
  imageBlob: Blob
  imageFileName?: string
}

export async function createParkingEntry(params: CreateParkingEntryParams): Promise<void> {
  const plate = params.licencePlate.trim()
  const { vehicleTypeId, garageId, spotId, imageBlob } = params
  const imageFileName = params.imageFileName ?? 'ticket.jpg'

  let vehicleId: number
  try {
    const byPlate = await getVehicleByPlate(plate)
    vehicleId = byPlate.data.id
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      const create = await createVehicle({
        licence_plate: plate,
        vehicle_type_id: vehicleTypeId,
      })
      vehicleId = create.data.id
    } else {
      throw e
    }
  }

  const { url: imageUrl } = await uploadTicketImage(imageBlob, imageFileName)

  await ticketEntry({
    vehicle_id: vehicleId,
    garage_id: garageId,
    spot_id: spotId ?? undefined,
    rentable_only: false,
    image_url: imageUrl,
  })
}
