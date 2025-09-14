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

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!L || L === 'error') {
      return
    }

    if (mapRef.current) {
      return
    }

    // Check for container with retries
    const initMapWithRetry = (attempt = 1) => {
      if (mapContainerRef.current) {
        try {
          // Start with Finland/Stockholm area - good for mushroom hunting
          const map = L.map(mapContainerRef.current, {
            center: [60.1699, 24.9384],
            zoom: 8,
            zoomControl: true
          })

          const tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            maxZoom: 17,
            minZoom: 5
          })
          
          tileLayer.addTo(map)

          const markersLayer = L.layerGroup().addTo(map)
          markersLayerRef.current = markersLayer

          mapRef.current = map
          setIsMapLoaded(true)
        } catch (error) {
          console.error('Map initialization failed:', error)
          if (attempt < 3) {
            setTimeout(() => initMapWithRetry(attempt + 1), 1000)
          }
        }
      } else if (attempt < 10) {
        setTimeout(() => initMapWithRetry(attempt + 1), 100)
      }
    }

    initMapWithRetry()
  }, [L])

  // Add markers to map
  useEffect(() => {
    if (!markersLayerRef.current || !L) return

    markersLayerRef.current.clearLayers()

    const mushroomIcon = L.divIcon({
      html: '<div style="background: #8B5A2B; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">🍄</div>',
      className: 'mushroom-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })

    // Add markers to map
    markers.forEach(marker => {
      const leafletMarker = L.marker([marker.lat, marker.lng], { icon: mushroomIcon })
      
      // Add click handler to open modern modal
      leafletMarker.on('click', () => {
        setSelectedMarker(marker)
      })
      
      markersLayerRef.current?.addLayer(leafletMarker)
    })
  }, [markers, L])

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

  const zoomToStockholm = () => {
    // Zoom to Stockholm/Finland area - good starting point for Nordic mushroom hunting
    if (mapRef.current) {
      mapRef.current.setView([60.1699, 24.9384], 10, {
        animate: true,
        duration: 1
      })
    }
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Modern Glass Header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-r from-green-500/80 to-emerald-600/80 backdrop-blur-md border-b border-white/20 shadow-lg z-[10000]">
        <div className="flex items-center justify-between h-full px-4">
          <h1 className="text-white font-semibold text-lg">Min Svampkarta</h1>
          
          <button 
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-full right-4 mt-1 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 min-w-48 py-2">
            <div className="px-4 py-2 text-gray-600 text-sm border-b border-gray-200/50">
              <div className="font-medium">Meny</div>
            </div>
            <div className="py-1">
              <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-3">
                <span className="text-lg">📊</span>
                <span className="font-medium">Statistik</span>
              </button>
              <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-3">
                <span className="text-lg">⚙️</span>
                <span className="font-medium">Inställningar</span>
              </button>
              <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-3">
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

      {/* Floating Location Button - now just zooms to Stockholm area */}
      <div className="fixed bottom-8 right-28" style={{ zIndex: 10000 }}>
        <button 
          onClick={zoomToStockholm}
          className="relative w-16 h-16 rounded-2xl text-white text-xl font-light shadow-2xl transition-all duration-300 transform backdrop-blur-sm border border-opacity-20 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-110 hover:shadow-3xl border-blue-300"
          style={{
            boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3), 0 8px 16px rgba(59, 130, 246, 0.2)'
          }}
        >
          <span className="block">🏠</span>
          
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
          paddingTop: '48px' // Space for header
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
      ) : (!isMapLoaded && L && L !== 'error') ? (
        <div className="absolute inset-0 bg-green-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-green-600">Laddar karta...</p>
          </div>
        </div>
      ) : null}

      {/* Add Marker Form Modal */}
      {pendingMarker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10001 }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4 shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">Lägg till svampfynd</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Svampart *
                </label>
                <input
                  type="text"
                  value={newMarkerForm.name}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, name: e.target.value })}
                  placeholder="t.ex. Kantarell, Karljohan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anteckningar
                </label>
                <textarea
                  value={newMarkerForm.notes}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, notes: e.target.value })}
                  placeholder="Beskrivning, storlek, mängd..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button 
                onClick={cancelAddMarker}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded hover:bg-gray-300 transition-colors font-medium"
              >
                Avbryt
              </button>
              <button 
                onClick={addMarker}
                disabled={!newMarkerForm.name.trim()}
                className="flex-1 bg-green-500 text-white py-3 px-4 rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Lägg till
              </button>
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
                  onClick={() => handleDeleteMarker(selectedMarker.id)}
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
