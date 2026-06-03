import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import garageIcon from '../../assets/images/urban-parking-garage.svg'
import { StandardDropdown } from '../ui/StandardDropdown'
import './dashboard-components.css'

export type GarageSelectDropdownProps = {
  garages: Array<{ id: number; name: string }>
  modelValue: number | null
  onModelValueChange?: (value: number | null) => void
}

export function GarageSelectDropdown({
  garages,
  modelValue,
  onModelValueChange,
}: GarageSelectDropdownProps) {
  const { t } = useTranslation()

  const garageOptions = useMemo(
    () => garages.map((g) => ({ id: g.id, label: g.name })),
    [garages],
  )

  return (
    <div className="by-garage-card__right-row h-full">
      <div className="by-garage-card__dropdown-wrap by-garage-card__cell relative flex h-full min-h-0 w-full flex-col">
        <div className="by-garage-card__icon-region flex min-h-0 flex-1 items-center justify-center">
          <span className="by-garage-card__icon" aria-hidden="true">
            <img src={garageIcon} alt="" className="by-garage-card__icon-img" />
          </span>
        </div>
        <div className="w-full min-w-0 shrink-0">
          <StandardDropdown
            label={t('garageSelectDropdown.title')}
            options={garageOptions}
            modelValue={modelValue}
            nullable
            nullOptionLabel={t('garageSelectDropdown.allGarages')}
            placeholder={t('garageSelectDropdown.selectGarage')}
            onModelValueChange={(v) =>
              onModelValueChange?.(v as number | null)
            }
          />
        </div>
      </div>
    </div>
  )
}
