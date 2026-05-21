import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import { parseApiError } from '../../api/error'
import {
  useVehicleEntryOptions,
  type VehicleEntryFormShape,
} from '../../composables/useVehicleEntryOptions'
import { createParkingEntry } from '../../services/createParkingEntry'
import { resizeImageToJpeg } from '../../utils/imageResize'
import { ButtonIn } from '../ui/ButtonIn'
import { InputIn } from '../ui/InputIn'
import { Modal } from '../ui/Modal'
import { StandardDropdown } from '../ui/StandardDropdown'

export type NewVehicleEntryModalProps = {
  modelValue: boolean
  onModelValueChange?: (value: boolean) => void
  onDone?: () => void
}

type EntryFormState = VehicleEntryFormShape & {
  licence_plate: string
  vehicle_type_id: number | null
  ticketImageDisplayName: string | null
  resizedImageBlob: Blob | null
}

const emptyForm = (): EntryFormState => ({
  licence_plate: '',
  vehicle_type_id: null,
  garage_id: null,
  spot_id: null,
  ticketImageDisplayName: null,
  resizedImageBlob: null,
})

export function NewVehicleEntryModal({
  modelValue,
  onModelValueChange,
  onDone,
}: NewVehicleEntryModalProps) {
  const { t } = useTranslation()
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const imagePickGeneration = useRef(0)

  const [form, setForm] = useState<EntryFormState>(emptyForm)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const setGarageFormSlice = useCallback<
    Dispatch<SetStateAction<VehicleEntryFormShape>>
  >((action) => {
    setForm((prev) => {
      const slice =
        typeof action === 'function'
          ? action({
              garage_id: prev.garage_id,
              spot_id: prev.spot_id,
            })
          : action
      return { ...prev, ...slice }
    })
  }, [])

  const {
    vehicleTypeOptions,
    garageOptions,
    spotOptions,
    optionsError,
    loadVehicleTypesAndGarages,
    onGarageSelect,
    resetSpots,
    setOptionsError,
  } = useVehicleEntryOptions(
    { garage_id: form.garage_id, spot_id: form.spot_id },
    setGarageFormSlice,
  )

  const displayError = error || optionsError

  const isImageReady = !!form.resizedImageBlob
  const isFormFieldsReady = useMemo(() => {
    const plate = form.licence_plate.trim()
    return !!plate && form.vehicle_type_id !== null && form.garage_id !== null
  }, [form.licence_plate, form.vehicle_type_id, form.garage_id])
  const isCreateEntryReady = isFormFieldsReady && isImageReady

  function close() {
    onModelValueChange?.(false)
    setError('')
    setSuccess('')
  }

  async function onImageChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0] ?? null

    setError('')
    setSuccess('')

    if (!file) {
      setForm((prev) => ({
        ...prev,
        resizedImageBlob: null,
        ticketImageDisplayName: null,
      }))
      setImageProcessing(false)
      return
    }

    imagePickGeneration.current += 1
    const gen = imagePickGeneration.current

    setForm((prev) => ({
      ...prev,
      ticketImageDisplayName: file.name,
      resizedImageBlob: null,
    }))
    setImageProcessing(true)

    try {
      const blob = await resizeImageToJpeg(file)
      if (gen !== imagePickGeneration.current) return
      setForm((prev) => ({ ...prev, resizedImageBlob: blob }))
    } catch {
      if (gen !== imagePickGeneration.current) return
      setForm((prev) => ({
        ...prev,
        resizedImageBlob: null,
        ticketImageDisplayName: null,
      }))
      input.value = ''
      setError(t('entry.imageResizeFailed'))
    } finally {
      if (gen === imagePickGeneration.current) {
        setImageProcessing(false)
      }
    }
  }

  function clearImage() {
    imagePickGeneration.current += 1
    setForm((prev) => ({
      ...prev,
      resizedImageBlob: null,
      ticketImageDisplayName: null,
    }))
    setImageProcessing(false)
    setError('')
    setSuccess('')
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!modelValue) return
    setOptionsError('')
    void loadVehicleTypesAndGarages()
    imagePickGeneration.current += 1
    setImageProcessing(false)
    setForm(emptyForm())
    if (imageInputRef.current) imageInputRef.current.value = ''
    resetSpots()
  }, [
    modelValue,
    loadVehicleTypesAndGarages,
    resetSpots,
    setOptionsError,
  ])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setSuccess('')
    const plate = form.licence_plate.trim()
    const vehicleTypeId = form.vehicle_type_id
    const garageId = form.garage_id
    if (!plate || !vehicleTypeId || !garageId) return
    if (!form.resizedImageBlob) {
      setError(t('entry.noFileChosen'))
      return
    }

    setLoading(true)
    try {
      await createParkingEntry({
        licencePlate: plate,
        vehicleTypeId,
        garageId,
        spotId: form.spot_id,
        imageBlob: form.resizedImageBlob,
        imageFileName: 'ticket.jpg',
      })
      setSuccess(t('toast.vehicleCreated'))
      window.setTimeout(() => onDone?.(), 800)
    } catch (err: unknown) {
      setError(parseApiError(err, t('entry.createFailed')).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      modelValue={modelValue}
      title={t('header.newVehicleEntry')}
      onModelValueChange={onModelValueChange}
    >
      <form
        onSubmit={(ev) => {
          void submit(ev)
        }}
      >
        <div className="space-y-4">
          <InputIn
            id="licence_plate"
            modelValue={form.licence_plate}
            onModelValueChange={(v) =>
              setForm((prev) => ({ ...prev, licence_plate: String(v) }))
            }
            label={t('entry.licencePlate')}
            type="text"
            required
            placeholder="e.g. AB123CD"
          />
          <div>
            <StandardDropdown
              label={t('entry.vehicleType')}
              options={vehicleTypeOptions}
              modelValue={form.vehicle_type_id}
              placeholder={t('entry.selectType')}
              nullable={false}
              onModelValueChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  vehicle_type_id: (v as number | null) ?? null,
                }))
              }
            />
          </div>
          <div>
            <StandardDropdown
              label={t('entry.garage')}
              options={garageOptions}
              modelValue={form.garage_id}
              placeholder={t('entry.selectGarage')}
              nullable={false}
              onModelValueChange={(v) => onGarageSelect(v as number | null)}
            />
          </div>
          <div>
            <StandardDropdown
              label={t('entry.spot')}
              options={spotOptions}
              modelValue={form.spot_id}
              nullable
              nullOptionLabel={t('entry.spotAutoAssign')}
              onModelValueChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  spot_id: (v as number | null) ?? null,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('entry.ticketImage')}
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={onImageChange}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ButtonIn
                id="chooseFileBtn"
                type="button"
                label={t('entry.chooseFile')}
                variant="outline"
                caption={t('entry.chooseFile')}
                disabled={imageProcessing}
                onUserClick={() => imageInputRef.current?.click()}
              />
              <p className="text-sm text-slate-500">
                {form.ticketImageDisplayName && imageProcessing ? (
                  <>
                    {t('entry.imageProcessing')}: {form.ticketImageDisplayName}
                  </>
                ) : form.ticketImageDisplayName && form.resizedImageBlob ? (
                  t('entry.imageReady', { name: form.ticketImageDisplayName })
                ) : (
                  t('entry.noFileChosen')
                )}
              </p>
              {imageProcessing || form.resizedImageBlob ? (
                <button
                  type="button"
                  className="text-sm text-slate-600 underline hover:text-slate-800"
                  onClick={clearImage}
                >
                  {t('entry.clearImage')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {displayError ? (
          <p className="mt-2 text-sm text-red-600">{displayError}</p>
        ) : null}
        {success ? (
          <p className="mt-2 text-sm text-green-600">{success}</p>
        ) : null}

        <div className="mt-6 flex justify-between gap-2">
          <ButtonIn
            id="cancelBtn"
            label={t('entry.cancel')}
            variant="outline"
            onUserClick={close}
            caption={t('entry.cancel')}
          />
          <ButtonIn
            id="createEntryBtn"
            label={t('entry.createEntry')}
            variant="primary"
            disabled={loading || !isCreateEntryReady}
            onUserClick={() => void submit()}
            caption={t('entry.createEntry')}
          />
        </div>
      </form>
    </Modal>
  )
}
