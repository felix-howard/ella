/**
 * Address Autocomplete - Google Places Autocomplete for US addresses
 * Loads the Google Maps JS SDK on demand and provides address suggestions
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin } from 'lucide-react'

interface AddressResult {
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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isReady, setIsReady] = useState(googleMapsLoaded)

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.address_components) return

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

    // Override the input value to show only the street (Google sets the full address)
    if (inputRef.current) {
      inputRef.current.value = address
    }

    onSelect({ address, city, state, zip })
  }, [onSelect])

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return

    loadGoogleMaps().then(() => {
      setIsReady(true)
    })
  }, [])

  useEffect(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components'],
    })

    autocomplete.addListener('place_changed', handlePlaceChanged)
    autocompleteRef.current = autocomplete

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [isReady, handlePlaceChanged])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    </div>
  )
}
