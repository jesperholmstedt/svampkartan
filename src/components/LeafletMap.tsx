'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface MushroomMarker {
  id: number
  name: string
  lat: number
  lng: number
  date: string
  notes?: string
}

interface LeafletMapProps {
  markers: MushroomMarker[]
  isAddingMarker: boolean
  onMarkerClick: (marker: MushroomMarker) => void
  onMapClick: (position: {lat: number, lng: number}) => void
  onDeleteMarker: (id: number) => void
}

export default function LeafletMap({ 
  markers, 
  isAddingMarker, 
  onMarkerClick, 
  onMapClick, 
  onDeleteMarker 
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Create map centered on Helsinki, Finland
    const map = L.map(mapContainerRef.current).setView([60.1699, 24.9384], 10)

    // Add Finnish MML (Maanmittauslaitos) topographic map
    L.tileLayer('https://tiles.kartat.kapsi.fi/peruskartta/{z}/{x}/{y}.jpg', {
      attribution: '&copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
      maxZoom: 18,
      minZoom: 5
    }).addTo(map)

    // Create markers layer
    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer

    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers on map
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return

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
  }, [markers])

  // Handle map clicks for adding markers
  useEffect(() => {
    if (!mapRef.current) return

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isAddingMarker) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
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
  }, [isAddingMarker, onMapClick])

  // Global functions for popup buttons
  useEffect(() => {
    (window as any).selectMarker = (id: number) => {
      const marker = markers.find(m => m.id === id)
      if (marker) onMarkerClick(marker)
    }

    (window as any).deleteMarker = (id: number) => {
      onDeleteMarker(id)
    }

    return () => {
      delete (window as any).selectMarker
      delete (window as any).deleteMarker
    }
  }, [markers, onMarkerClick, onDeleteMarker])

  return (
    <div 
      ref={mapContainerRef}
      className="h-96 rounded-lg border border-gray-300"
      style={{ minHeight: '400px' }}
    />
  )
}
