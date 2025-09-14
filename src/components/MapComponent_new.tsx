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
  const [debugLog, setDebugLog] = useState<string[]>([])

  // Helper function to add debug messages
  const addDebug = (message: string) => {
    setDebugLog(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // Initialize Leaflet only on client side
  useEffect(() => {
    let mounted = true
    
    const loadLeaflet = async () => {
      try {
        addDebug('Starting to load Leaflet...')
        const leafletModule = await import('leaflet')
        addDebug('Leaflet module loaded successfully')
        if (mounted) {
          setL(leafletModule.default)
          addDebug('Leaflet set successfully')
        }
      } catch (error) {
        addDebug(`Failed to load Leaflet: ${error}`)
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
      addDebug('No Leaflet or error state')
      return
    }

    if (mapRef.current) {
      addDebug('Map already exists')
      return
    }

    // Check for container with retries
    const initMapWithRetry = (attempt = 1) => {
      addDebug(`Attempt ${attempt}: Looking for container...`)
      
      if (mapContainerRef.current) {
        addDebug('Container found! Starting map initialization...')
        
        try {
          addDebug('Creating map...')
          const map = L.map(mapContainerRef.current, {
            center: [60.1699, 24.9384],
            zoom: 10,
            zoomControl: true
          })
          addDebug('Map created successfully')

          addDebug('Adding tile layer...')
          const tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            maxZoom: 17,
            minZoom: 5
          })
          
          tileLayer.addTo(map)
          addDebug('Tile layer added')

          addDebug('Creating markers layer...')
          const markersLayer = L.layerGroup().addTo(map)
          markersLayerRef.current = markersLayer
          addDebug('Markers layer created')

          mapRef.current = map
          setIsMapLoaded(true)
          addDebug('Map initialization COMPLETE!')
        } catch (error) {
          addDebug(`ERROR: ${error}`)
          setL('error')
        }
      } else if (attempt < 5) {
        addDebug(`Container not ready, retrying in ${attempt * 100}ms...`)
        setTimeout(() => initMapWithRetry(attempt + 1), attempt * 100)
      } else {
        addDebug('ERROR: Container never became available')
        setL('error')
      }
    }

    initMapWithRetry()

    return () => {
      if (mapRef.current) {
        addDebug('Cleaning up map')
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [L])

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
        .bindPopup(`
          <div style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-weight: bold;">${marker.name}</h3>
            <p style="margin: 4px 0; color: #666; font-size: 14px;">📅 ${marker.date}</p>
            ${marker.notes ? `<p style="margin: 4px 0; font-size: 14px;">${marker.notes}</p>` : ''}
            <div style="margin-top: 12px;">
              <button onclick="window.selectMarker(${marker.id})" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 8px; cursor: pointer;">Detaljer</button>
              <button onclick="window.deleteMarker(${marker.id})" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Ta bort</button>
            </div>
          </div>
        `)
      
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

  const deleteMarker = (id: number) => {
    setMarkers(markers.filter(marker => marker.id !== id))
    setSelectedMarker(null)
  }

  return (
    <div className="fixed inset-0 w-full h-full">
      {/* Fullscreen Map Container */}
      <div 
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height: '100vh', width: '100vw' }}
      />

      {/* Floating Add Button */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={() => setIsAddingMarker(!isAddingMarker)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-lg ${
            isAddingMarker 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isAddingMarker ? '✕ Avbryt' : '+ Lägg till'}
        </button>
      </div>

      {/* Floating instruction when adding marker */}
      {isAddingMarker && (
        <div className="absolute top-20 left-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-center">
            Klicka på kartan för att markera en ny plats
          </div>
        </div>
      )}

      {/* Loading/Error overlay */}
      {L === 'error' ? (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-40">
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
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-40">
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
        <div className="absolute bottom-4 left-4 right-4 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg border">
            <h4 className="font-semibold text-gray-800 mb-3">Lägg till svampfynd</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Svampart *
                </label>
                <input
                  type="text"
                  placeholder="t.ex. Kantarell, Karljohan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newMarkerForm.name}
                  onChange={(e) => setNewMarkerForm({...newMarkerForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anteckningar
                </label>
                <textarea
                  placeholder="Beskrivning, antal, miljö..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  value={newMarkerForm.notes}
                  onChange={(e) => setNewMarkerForm({...newMarkerForm, notes: e.target.value})}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={addMarker}
                  disabled={!newMarkerForm.name.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Spara
                </button>
                <button
                  onClick={cancelAddMarker}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marker details modal */}
      {selectedMarker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-xl font-semibold">{selectedMarker.name}</h4>
              <button
                onClick={() => setSelectedMarker(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <p><strong>Datum:</strong> {selectedMarker.date}</p>
              <p><strong>Koordinater:</strong> {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}</p>
              {selectedMarker.notes && (
                <div>
                  <strong>Anteckningar:</strong>
                  <p className="text-gray-700 mt-1">{selectedMarker.notes}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex space-x-2">
              <button 
                onClick={() => setSelectedMarker(null)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
              >
                Stäng
              </button>
              <button 
                onClick={() => deleteMarker(selectedMarker.id)}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
              >
                Ta bort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug info - floating in corner */}
      {debugLog.length > 0 && (
        <div className="absolute bottom-4 left-4 z-40 max-w-xs">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs opacity-80">
            <strong>Debug:</strong>
            {debugLog.slice(-2).map((log, i) => (
              <div key={i} className="mt-1 font-mono text-blue-800">{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
