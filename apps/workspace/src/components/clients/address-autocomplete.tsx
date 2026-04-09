/**
 * Address Autocomplete using Google Places AutocompleteService.
 * Mirrors the portal's contractor-intake version for consistent UX.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin } from 'lucide-react'

export interface AddressResult {
  address: string
  city: string
  state: string
  zip: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: AddressResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let googleMapsLoaded = false
let googleMapsLoading = false
const loadCallbacks: (() => void)[] = []

function loadGoogleMaps(): Promise<void> {
  if (googleMapsLoaded) return Promise.resolve()
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('No Google Maps API key'))

  return new Promise((resolve) => {
    loadCallbacks.push(resolve)
    if (googleMapsLoading) return

    googleMapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = () => {
      googleMapsLoaded = true
      googleMapsLoading = false
      loadCallbacks.forEach((cb) => cb())
      loadCallbacks.length = 0
    }
    document.head.appendChild(script)
  })
}

interface Prediction {
  placeId: string
  description: string
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  disabled,
  required,
  id,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isReady, setIsReady] = useState(googleMapsLoaded)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    loadGoogleMaps().then(() => setIsReady(true))
  }, [])

  useEffect(() => {
    if (!isReady) return
    serviceRef.current = new google.maps.places.AutocompleteService()
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
  }, [isReady])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchPredictions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setPredictions([])
      return
    }

    serviceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'us' },
        types: ['address'],
        sessionToken: sessionTokenRef.current!,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(
            results.map((r) => ({
              placeId: r.place_id,
              description: r.description,
            }))
          )
          setShowDropdown(true)
        } else {
          setPredictions([])
        }
      }
    )
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300)
  }

  const handleSelectPrediction = (prediction: Prediction) => {
    setShowDropdown(false)
    setPredictions([])

    const div = document.createElement('div')
    const placesService = new google.maps.places.PlacesService(div)

    placesService.getDetails(
      {
        placeId: prediction.placeId,
        fields: ['address_components'],
        sessionToken: sessionTokenRef.current!,
      },
      (place, status) => {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.address_components) {
          onChange(prediction.description)
          return
        }

        let streetNumber = ''
        let route = ''
        let city = ''
        let state = ''
        let zip = ''

        for (const component of place.address_components) {
          const types = component.types
          if (types.includes('street_number')) {
            streetNumber = component.long_name
          } else if (types.includes('route')) {
            route = component.long_name
          } else if (types.includes('locality')) {
            city = component.long_name
          } else if (types.includes('sublocality_level_1') && !city) {
            city = component.long_name
          } else if (types.includes('administrative_area_level_1')) {
            state = component.short_name
          } else if (types.includes('postal_code')) {
            zip = component.long_name
          }
        }

        const address = streetNumber ? `${streetNumber} ${route}` : route
        onSelect({ address, city, state, zip })
      }
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        required={required}
        maxLength={500}
        autoComplete="off"
      />
      {GOOGLE_MAPS_API_KEY && (
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      )}

      {showDropdown && predictions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectPrediction(p)}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
