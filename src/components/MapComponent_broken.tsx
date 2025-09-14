'use client'

import { useState, useEffect, useRef } from 'react'

interface MushroomMarker {
  id: number
  name: string
  lat: number
  lng: number
  date: string
  notes?: string
}

interface MapComponentProps {
  className?: string
}

export default function MapComponent({ className = '' }: MapComponentProps) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<any>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [L, setL] = useState<any>(null)
  
  const [markers, setMarkers] = useState<MushroomMarker[]>([
    { id: 1, name: "Kantarell", lat: 60.1699, lng: 24.9384, date: "2025-09-10", notes: "Många små kantareller under gran" },
    { id: 2, name: "Karljohan", lat: 60.2000, lng: 25.0000, date: "2025-09-08", notes: "Stor karljohan vid stigen" },
    { id: 3, name: "Trattkantarell", lat: 60.1500, lng: 24.8000, date: "2025-09-05", notes: "Stora grupper" }
  ])
  const [selectedMarker, setSelectedMarker] = useState<MushroomMarker | null>(null)
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  const [newMarkerForm, setNewMarkerForm] = useState({ name: '', notes: '' })
  const [pendingMarker, setPendingMarker] = useState<{lat: number, lng: number} | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [hasRealUserLocation, setHasRealUserLocation] = useState(false)

  // Initialize Leaflet only on client side
  useEffect(() => {
    let mounted = true
    
    const loadLeaflet = async () => {
      try {
        const leafletModule = await import('leaflet')
        if (mounted) {
          setL(leafletModule.default)
        }
      } catch (error) {
        if (mounted) {
          setL('error')
        }
      }
    }
    
    // Add a small delay to ensure DOM is ready
    setTimeout(loadLeaflet, 100)
    
    return () => {
      mounted = false
    }
  }, [])

  // Just load with a good default location
  useEffect(() => {
    // Default to Finland/Stockholm area - good for mushroom hunting
    const defaultLocation = { lat: 60.1699, lng: 24.9384 }
    setUserLocation(defaultLocation)
    setHasRealUserLocation(false)
  }, [])

  const getCurrentLocation = () => {
    setLocationStatus('🔍 Begär GPS-position...')
    
    if ('geolocation' in navigator) {
      console.log('User clicked - requesting geolocation now...')
      
      // First, try to check permissions explicitly
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          console.log('Permission status before request:', result.state)
          
          if (result.state === 'denied') {
            setLocationStatus('❌ GPS blockerat i webbläsaren - rensa webbplatsdata')
            console.log('Permission is denied - user needs to reset browser permissions')
            return
          }
          
          // Try geolocation request
          requestGPS()
        }).catch(() => {
          console.log('Permissions API not supported, trying direct request')
          requestGPS()
        })
      } else {
        requestGPS()
      }
    } else {
      setLocationStatus('❌ GPS stöds ej av denna webbläsare')
      setTimeout(() => setLocationStatus(''), 5000)
    }
  }

  const requestGPS = () => {
    console.log('Making GPS request with high accuracy...')
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        console.log('SUCCESS: Got user location:', latitude, longitude)
        setUserLocation({ lat: latitude, lng: longitude })
        setHasRealUserLocation(true)
        setLocationStatus('✅ GPS-position hittad!')
        
        // Hide status after 3 seconds
        setTimeout(() => setLocationStatus(''), 3000)
      },
      (error) => {
        console.log('ERROR: Geolocation failed:', error.message, 'Code:', error.code)
        
        if (error.code === 1) {
          setLocationStatus('❌ GPS blockerat - gå till webbläsarinställningar och tillåt plats för denna sida')
        } else if (error.code === 2) {
          setLocationStatus('❌ GPS position ej tillgänglig - försök utomhus')
        } else if (error.code === 3) {
          setLocationStatus('❌ GPS-timeout - försök igen')
        } else {
          setLocationStatus('❌ GPS-fel uppstod')
        }
        
        // Hide error after 8 seconds
        setTimeout(() => setLocationStatus(''), 8000)
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // Longer timeout
        maximumAge: 0 // Force completely fresh location
      }
    )
  }

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!L || L === 'error' || !userLocation) {
      return
    }

    if (mapRef.current) {
      return
    }

    // Check for container with retries
    const initMapWithRetry = (attempt = 1) => {
      if (mapContainerRef.current) {
        try {
          const map = L.map(mapContainerRef.current, {
            center: [userLocation.lat, userLocation.lng],
            zoom: 13, // Closer zoom for user location
            zoomControl: true
          })

          const tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            maxZoom: 17,
            minZoom: 5
          })
          
          tileLayer.addTo(map)

          // Add user location marker
          const userIcon = L.divIcon({
            html: '<div style="background: #10b981; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            className: 'user-location-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
          
          L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup('📍 Din nuvarande position')

          const markersLayer = L.layerGroup().addTo(map)
          markersLayerRef.current = markersLayer

          mapRef.current = map
          setIsMapLoaded(true)
        } catch (error) {
          setL('error')
        }
      } else if (attempt < 5) {
        setTimeout(() => initMapWithRetry(attempt + 1), attempt * 100)
      } else {
        setL('error')
      }
    }

    initMapWithRetry()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [L, userLocation])

  // Update markers on map
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current || !L) return

    // Clear existing markers
    markersLayerRef.current.clearLayers()

    // Create custom mushroom icon
    const mushroomIcon = L.divIcon({
      html: '<div style="background: #ef4444; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🍄</div>',
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })

    // Add markers to map
    markers.forEach(marker => {
      const leafletMarker = L.marker([marker.lat, marker.lng], { icon: mushroomIcon })
      
      // Add click handler to open modern modal instead of ugly popup
      leafletMarker.on('click', () => {
        setSelectedMarker(marker)
      })
      
      markersLayerRef.current?.addLayer(leafletMarker)
    })
  }, [markers, L])

  // Update map center when user location changes (after geolocation finishes)
  useEffect(() => {
    if (!mapRef.current || !userLocation || !hasRealUserLocation) return

    console.log('Updating map to real user location:', userLocation)
    mapRef.current.setView([userLocation.lat, userLocation.lng], 15)
    
    // Update or add user location marker
    if (mapRef.current && L) {
      const userIcon = L.divIcon({
        html: '<div style="background: #10b981; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        className: 'user-location-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      
      // Remove existing user marker if any
      mapRef.current.eachLayer((layer: any) => {
        if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-icon') {
          mapRef.current.removeLayer(layer)
        }
      })
      
      // Add new user marker
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(mapRef.current)
        .bindPopup('📍 Din nuvarande position')
    }
  }, [userLocation, hasRealUserLocation, L])

  // Handle map clicks for adding markers
  useEffect(() => {
    if (!mapRef.current || !L) return

    const handleMapClick = (e: any) => {
      if (isAddingMarker) {
        setPendingMarker({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    }

    if (isAddingMarker) {
      mapRef.current.on('click', handleMapClick)
      mapRef.current.getContainer().style.cursor = 'crosshair'
    } else {
      mapRef.current.off('click', handleMapClick)
      mapRef.current.getContainer().style.cursor = ''
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick)
        mapRef.current.getContainer().style.cursor = ''
      }
    }
  }, [isAddingMarker, L])

  // Global functions for popup buttons
  useEffect(() => {
    (window as any).selectMarker = (id: number) => {
      const marker = markers.find(m => m.id === id)
      if (marker) setSelectedMarker(marker)
    }

    (window as any).deleteMarker = (id: number) => {
      setMarkers(markers.filter(m => m.id !== id))
    }

    return () => {
      delete (window as any).selectMarker
      delete (window as any).deleteMarker
    }
  }, [markers])

  // Close menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  const addMarker = () => {
    if (!pendingMarker || !newMarkerForm.name.trim()) return
    
    const newMarker: MushroomMarker = {
      id: Date.now(),
      name: newMarkerForm.name,
      lat: pendingMarker.lat,
      lng: pendingMarker.lng,
      date: new Date().toISOString().split('T')[0],
      notes: newMarkerForm.notes
    }
    
    setMarkers([...markers, newMarker])
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '' })
  }

  const cancelAddMarker = () => {
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '' })
  }

  const handleDeleteMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id))
    setSelectedMarker(null)
  }

  const requestLocationAgain = () => {
    setLocationStatus('Begär GPS-position igen...')
    setShowLocationPicker(false)
    getCurrentLocation()
  }

  const setLocationManually = () => {
    setLocationStatus('Klicka på kartan där du befinner dig')
    setShowLocationPicker(false)
    
    // Enable manual location mode
    const handleMapClick = (e: any) => {
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng })
      setHasRealUserLocation(true)
      setLocationStatus('✅ Position inställd manuellt!')
      setTimeout(() => setLocationStatus(''), 3000)
      
      // Remove the click handler
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick)
        mapRef.current.getContainer().style.cursor = ''
      }
    }
    
    if (mapRef.current) {
      mapRef.current.on('click', handleMapClick)
      mapRef.current.getContainer().style.cursor = 'crosshair'
    }
  }

  const zoomToUserLocation = () => {
    console.log('Location button clicked. UserLocation:', userLocation, 'HasReal:', hasRealUserLocation)
    
    if (!hasRealUserLocation) {
      // If we don't have real location, request it now
      getCurrentLocation()
    } else if (mapRef.current && userLocation) {
      // If we have real location, zoom to it
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15, {
        animate: true,
        duration: 1
      })
      
      // Show popup on user location marker if it exists
      mapRef.current.eachLayer((layer: any) => {
        if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-icon') {
          layer.openPopup()
        }
      })
    }
  }

  const deleteMarker = (id: number) => {
    setMarkers(markers.filter(marker => marker.id !== id))
    setSelectedMarker(null)
  }

  return (
    <div className="fixed inset-0 w-full h-full">
      {/* Header with Menu */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-600 to-green-600 backdrop-blur-md bg-opacity-95 shadow-xl" style={{ zIndex: 10000 }}>
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-lg">🍄</span>
            </div>
            <h1 className="text-base font-light text-white tracking-wider">Min Svampkarta</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Menu button */}
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 hover:bg-white hover:bg-opacity-10 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white border-opacity-20"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute top-full right-6 mt-2 bg-white bg-opacity-95 backdrop-blur-xl text-gray-800 rounded-2xl shadow-2xl border border-gray-200 border-opacity-20 min-w-56 overflow-hidden" style={{ zIndex: 10001 }}>
            <div className="py-2">
              <button className="w-full text-left px-5 py-3 hover:bg-gray-50 hover:bg-opacity-80 flex items-center space-x-3 transition-all duration-150">
                <span className="text-lg">📊</span>
                <span className="font-medium">Statistik</span>
              </button>
              <button className="w-full text-left px-5 py-3 hover:bg-gray-50 hover:bg-opacity-80 flex items-center space-x-3 transition-all duration-150">
                <span className="text-lg">📱</span>
                <span className="font-medium">Exportera data</span>
              </button>
              <button className="w-full text-left px-5 py-3 hover:bg-gray-50 hover:bg-opacity-80 flex items-center space-x-3 transition-all duration-150">
                <span className="text-lg">🗺️</span>
                <span className="font-medium">Kartinställningar</span>
              </button>
              <hr className="my-2 border-gray-200 border-opacity-30" />
              <button className="w-full text-left px-5 py-3 hover:bg-gray-50 hover:bg-opacity-80 flex items-center space-x-3 transition-all duration-150">
                <span className="text-lg">ℹ️</span>
                <span className="font-medium">Om appen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Add Button - Modern Design */}
      <div className="fixed bottom-8 right-8" style={{ zIndex: 10000 }}>
        <button 
          onClick={() => setIsAddingMarker(!isAddingMarker)}
          className={`relative w-16 h-16 rounded-2xl text-white text-2xl font-light shadow-2xl transition-all duration-300 transform backdrop-blur-sm border border-opacity-20 ${
            isAddingMarker 
              ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rotate-45 scale-95 border-red-300' 
              : 'bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 hover:scale-110 hover:shadow-3xl border-emerald-300'
          }`}
          style={{
            boxShadow: isAddingMarker 
              ? '0 20px 40px rgba(239, 68, 68, 0.3), 0 8px 16px rgba(239, 68, 68, 0.2)' 
              : '0 20px 40px rgba(16, 185, 129, 0.3), 0 8px 16px rgba(16, 185, 129, 0.2)'
          }}
        >
          <span className={`block transition-transform duration-300 ${isAddingMarker ? 'rotate-45' : ''}`}>
            +
          </span>
          
          {/* Ripple effect background */}
          <div className={`absolute inset-0 rounded-2xl bg-white bg-opacity-10 transition-all duration-300 ${
            isAddingMarker ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
          }`}></div>
        </button>
      </div>

      {/* Floating Location Button */}
      <div className="fixed bottom-8 right-28" style={{ zIndex: 10000 }}>
        <button 
          onClick={zoomToUserLocation}
          className="relative w-16 h-16 rounded-2xl text-white text-xl font-light shadow-2xl transition-all duration-300 transform backdrop-blur-sm border border-opacity-20 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-110 hover:shadow-3xl border-blue-300"
          style={{
            boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3), 0 8px 16px rgba(59, 130, 246, 0.2)'
          }}
        >
          <span className="block">📍</span>
          
          {/* Ripple effect background */}
          <div className="absolute inset-0 rounded-2xl bg-white bg-opacity-10 transition-all duration-300 scale-100 opacity-100"></div>
        </button>
      </div>

      {/* Map Container - adjusted for header */}
      <div 
        ref={mapContainerRef}
        className="w-full"
        style={{ 
          height: '100vh', 
          width: '100vw', 
          zIndex: 1,
          paddingTop: '52px' // Reduced from 60px to match smaller header
        }}
      />

      {/* Floating instruction when adding marker */}
      {isAddingMarker && (
        <div className="absolute top-20 left-4 right-4" style={{ zIndex: 10000 }}>
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-center max-w-md mx-auto">
            Klicka på kartan för att markera en ny plats
          </div>
        </div>
      )}

      {/* Loading/Error overlay */}
      {L === 'error' ? (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-red-600">Kartan kunde inte laddas</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Försök igen
            </button>
          </div>
        </div>
      ) : !isMapLoaded ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-gray-600">Laddar karta...</p>
            <div className="mt-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add marker form */}
      {pendingMarker && (
        <div className="absolute bottom-4 left-4 right-4" style={{ zIndex: 10000 }}>
          <div className="bg-white p-4 rounded-lg shadow-xl border max-w-md mx-auto">
            <h4 className="font-medium text-gray-800 mb-3 tracking-wide">Lägg till svampfynd</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 tracking-wide">
                  Svampart *
                </label>
                <input
                  type="text"
                  placeholder="t.ex. Kantarell, Karljohan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-light"
                  value={newMarkerForm.name}
                  onChange={(e) => setNewMarkerForm({...newMarkerForm, name: e.target.value})}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 tracking-wide">
                  Anteckningar
                </label>
                <textarea
                  placeholder="Beskrivning, antal, miljö..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none font-light"
                  value={newMarkerForm.notes}
                  onChange={(e) => setNewMarkerForm({...newMarkerForm, notes: e.target.value})}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={addMarker}
                  disabled={!newMarkerForm.name.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium tracking-wide"
                >
                  Spara
                </button>
                <button
                  onClick={cancelAddMarker}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-medium tracking-wide"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Marker Details Modal */}
      {selectedMarker && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 10001 }}
          onClick={() => setSelectedMarker(null)}
        >
          <div 
            className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-sm w-full border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {selectedMarker.name}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center">
                    <span className="mr-2">📅</span>
                    {selectedMarker.date}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Coordinates */}
              <div className="mb-4 p-3 bg-white/50 rounded-xl border border-white/30">
                <p className="text-xs text-gray-500 mb-1">KOORDINATER</p>
                <p className="text-sm font-mono text-gray-700">
                  {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
                </p>
              </div>

              {/* Notes */}
              {selectedMarker.notes && (
                <div className="mb-6 p-3 bg-white/50 rounded-xl border border-white/30">
                  <p className="text-xs text-gray-500 mb-2">ANTECKNINGAR</p>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {selectedMarker.notes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-medium shadow-lg hover:from-gray-500 hover:to-gray-600 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Stäng
                </button>
                <button
                  onClick={() => deleteMarker(selectedMarker.id)}
                  className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Ta bort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
