'use client'

import { useState, useEffect, useRef } from 'react'

interface MushroomMarker {
  id: number
  name: string
  lat: number
  lng: number
  date: string
  notes?: string
  abundance: number // 1-5 scale (1=few, 5=many)
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
    { id: 1, name: "Kantarell", lat: 60.1699, lng: 24.9384, date: "2025-09-10", notes: "Många små kantareller under gran", abundance: 4 },
    { id: 2, name: "Karljohan", lat: 60.2000, lng: 25.0000, date: "2025-09-08", notes: "Stor karljohan vid stigen", abundance: 2 },
    { id: 3, name: "Trattkantarell", lat: 60.1500, lng: 24.8000, date: "2025-09-05", notes: "Stora grupper", abundance: 5 }
  ])
  const [selectedMarker, setSelectedMarker] = useState<MushroomMarker | null>(null)
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  const [newMarkerForm, setNewMarkerForm] = useState({ name: '', notes: '', abundance: 3 })
  const [pendingMarker, setPendingMarker] = useState<{lat: number, lng: number} | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [carLocation, setCarLocation] = useState<{lat: number, lng: number} | null>(null)
  const [carMarkerRef, setCarMarkerRef] = useState<any>(null)
  const [showCarDirection, setShowCarDirection] = useState(false)
  const [carDirectionLine, setCarDirectionLine] = useState<any>(null)
  const [isParkingMode, setIsParkingMode] = useState(false)
  const [showCarControls, setShowCarControls] = useState(false)
  const [showParkingDialog, setShowParkingDialog] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('')
  const [watchId, setWatchId] = useState<number | null>(null)
  const [showFindsList, setShowFindsList] = useState(false)
  const [showNavigationDialog, setShowNavigationDialog] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState<MushroomMarker | null>(null)
  const [showWalkingDirection, setShowWalkingDirection] = useState(false)
  const [walkingDirectionLine, setWalkingDirectionLine] = useState<any>(null)
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false)
  const [currentNavigationDistance, setCurrentNavigationDistance] = useState<number | null>(null)
  const [isEditingMarker, setIsEditingMarker] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', notes: '', abundance: 3 })
  const [mapZoom, setMapZoom] = useState(13) // Track map zoom level
  const [showAddChoiceDialog, setShowAddChoiceDialog] = useState(false) // New choice dialog

  // Calculate dynamic sizes based on zoom level
  const getZoomBasedSizes = (zoom: number) => {
    // Base sizes at zoom level 13
    const baseZoom = 13
    const scaleFactor = Math.pow(1.15, zoom - baseZoom) // 15% increase per zoom level
    
    return {
      fontSize: Math.max(10, Math.min(16, 13 * scaleFactor)),
      padding: Math.max(6, Math.min(16, 10 * scaleFactor)),
      minWidth: Math.max(80, Math.min(180, 100 * scaleFactor)),
      maxWidth: Math.max(120, Math.min(220, 160 * scaleFactor)),
      dotSize: Math.max(3, Math.min(7, 5 * scaleFactor)),
      pinSize: Math.max(8, Math.min(16, 12 * scaleFactor))
    }
  }

  // Load saved markers from localStorage on component mount
  useEffect(() => {
    try {
      const savedMarkers = localStorage.getItem('svampkartan-markers')
      if (savedMarkers) {
        const parsed = JSON.parse(savedMarkers)
        setMarkers(parsed)
      }
    } catch (error) {
      console.log('Could not load saved markers:', error)
      // Keep default markers if loading fails
    }
  }, [])

  // Load saved car location from localStorage on component mount
  useEffect(() => {
    try {
      const savedCarLocation = localStorage.getItem('svampkartan-car-location')
      if (savedCarLocation) {
        const parsed = JSON.parse(savedCarLocation)
        setCarLocation(parsed)
        console.log('Loaded saved car location:', parsed)
      }
    } catch (error) {
      console.log('Could not load saved car location:', error)
    }
  }, [])

  // Create car marker when car location is loaded and map is ready
  useEffect(() => {
    if (carLocation && mapRef.current && L && isMapLoaded) {
      updateCarMarker(carLocation.lat, carLocation.lng)
    }
  }, [carLocation, mapRef.current, L, isMapLoaded])

  // Save markers to localStorage whenever markers change
  useEffect(() => {
    try {
      localStorage.setItem('svampkartan-markers', JSON.stringify(markers))
    } catch (error) {
      console.log('Could not save markers:', error)
    }
  }, [markers])

  // Comprehensive location management
  const requestLocation = () => {
    setLocationStatus('locating')
    
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }

    // First, try to get immediate position with relaxed settings
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        console.log('Got location:', latitude, longitude, 'accuracy:', accuracy)
        setUserLocation({ lat: latitude, lng: longitude })
        setLocationStatus('found')
        
        // Update or create user marker
        updateUserMarker(latitude, longitude)
        
        // Zoom map to user location
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15, {
            animate: true,
            duration: 1
          })
        }
        
        // Start watching for location changes
        startLocationWatch()
      },
      (error) => {
        console.log('First attempt failed, trying with lower accuracy...', error.message)
        
        // Retry with less strict settings
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords
            console.log('Got location on retry:', latitude, longitude, 'accuracy:', accuracy)
            setUserLocation({ lat: latitude, lng: longitude })
            setLocationStatus('found')
            updateUserMarker(latitude, longitude)
            
            if (mapRef.current) {
              mapRef.current.setView([latitude, longitude], 15, {
                animate: true,
                duration: 1
              })
            }
            
            startLocationWatch()
          },
          (retryError) => {
            console.log('Retry also failed:', retryError.message)
            handleLocationError(retryError)
          },
          {
            enableHighAccuracy: false,  // Less strict
            timeout: 30000,             // Longer timeout
            maximumAge: 300000          // Accept older location (5 min)
          }
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,              // Shorter initial timeout
        maximumAge: 60000
      }
    )
  }

  const startLocationWatch = () => {
    if (navigator.geolocation && !watchId) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          console.log('Location update:', latitude, longitude, 'accuracy:', accuracy)
          setUserLocation({ lat: latitude, lng: longitude })
          
          // Update user marker on map
          updateUserMarker(latitude, longitude)
        },
        (error) => {
          console.log('watchPosition error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 30000
        }
      )
      setWatchId(id)
    }
  }

  const stopLocationWatch = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }

  const handleLocationError = (error: GeolocationPositionError) => {
    console.error('Geolocation error:', error.code, error.message)
    setLocationStatus('error')
    
    // Show user-friendly error message
    let errorMessage = 'GPS-fel: '
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage += 'Tillstånd nekad. Aktivera plats i webbläsaren.'
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage += 'Position inte tillgänglig. Gå utomhus.'
        break
      case error.TIMEOUT:
        errorMessage += 'Timeout. Prova igen utomhus eller med bättre signal.'
        break
      default:
        errorMessage += 'Okänt fel. Kontrollera platsinställningar.'
        break
    }
    
    // Show error temporarily
    setTimeout(() => {
      if (confirm(errorMessage + '\n\nVill du försöka igen?')) {
        requestLocation()
      }
    }, 1000)
  }

  const updateUserMarker = (lat: number, lng: number) => {
    if (!mapRef.current || !L) return
    
    // Remove existing user marker
    mapRef.current.eachLayer((layer: any) => {
      if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-marker') {
        mapRef.current.removeLayer(layer)
      }
    })
    
    // Add new user marker
    const userIcon = L.divIcon({
      html: '<div style="background: #10b981; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>',
      className: 'user-location-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })
    
    L.marker([lat, lng], { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup(`
        <div style="
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.9) 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 16px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          min-width: 180px;
        ">
          <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
          <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">Din nuvarande position</div>
          <div style="font-size: 12px; opacity: 0.9;">GPS-position bekräftad</div>
        </div>
      `, {
        closeButton: true,
        className: 'modern-popup'
      })
  }

  // Distance calculation function using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in kilometers
  }

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    } else {
      return `${distance.toFixed(1)}km`
    }
  }

  // Navigation functions
  const navigateToMarker = (marker: MushroomMarker, mode: 'driving' | 'walking') => {
    if (!userLocation) {
      alert('Din position krävs för navigation. Aktivera GPS först.')
      return
    }

    const destination = `${marker.lat},${marker.lng}`
    const origin = `${userLocation.lat},${userLocation.lng}`
    
    // Detect if user is on iOS or Android for appropriate maps app
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)
    
    let url = ''
    
    if (isIOS) {
      // Use Apple Maps on iOS
      if (mode === 'driving') {
        url = `maps://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=d`
      } else {
        url = `maps://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=w`
      }
    } else if (isAndroid) {
      // Use Google Maps on Android
      if (mode === 'driving') {
        url = `google.navigation:q=${destination}&mode=d`
      } else {
        url = `google.navigation:q=${destination}&mode=w`
      }
    } else {
      // Fallback to Google Maps web for desktop/other devices
      if (mode === 'driving') {
        url = `https://www.google.com/maps/dir/${origin}/${destination}/data=!3m1!4b1!4m2!4m1!3e0`
      } else {
        url = `https://www.google.com/maps/dir/${origin}/${destination}/data=!3m1!4b1!4m2!4m1!3e2`
      }
    }
    
    window.open(url, '_blank')
    setShowNavigationDialog(false)
  }

  // Car location functions
  const toggleCarControls = () => {
    if (!carLocation) {
      // No car parked, start parking process
      parkCar()
    } else {
      // Car is parked, toggle controls visibility
      setShowCarControls(!showCarControls)
      
      // If hiding controls, also hide direction line
      if (showCarControls && showCarDirection) {
        setShowCarDirection(false)
        if (carDirectionLine && mapRef.current) {
          mapRef.current.removeLayer(carDirectionLine)
          setCarDirectionLine(null)
        }
      }
    }
  }

  const parkCar = () => {
    if (isParkingMode) {
      // Cancel parking mode
      setIsParkingMode(false)
      return
    }

    // Show nice custom dialog instead of ugly alert
    setShowParkingDialog(true)
  }

  const parkAtCurrentLocation = () => {
    setShowParkingDialog(false)
    
    if (!userLocation) {
      console.log('No user location available, requesting GPS first...')
      requestLocation()
      return
    }
    
    console.log('Parking car at current location:', userLocation)
    setCarLocation(userLocation)
    updateCarMarker(userLocation.lat, userLocation.lng)
    localStorage.setItem('svampkartan-car-location', JSON.stringify(userLocation))
    setShowCarControls(true)
  }

  const parkAtCustomLocation = () => {
    setShowParkingDialog(false)
    setIsParkingMode(true)
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (isParkingMode) {
      // Park car at clicked location
      const newCarLocation = { lat, lng }
      setCarLocation(newCarLocation)
      updateCarMarker(lat, lng)
      localStorage.setItem('svampkartan-car-location', JSON.stringify(newCarLocation))
      setIsParkingMode(false)
      setShowCarControls(true)
      return
    }

    // Normal mushroom marker logic
    if (isAddingMarker) {
      setPendingMarker({ lat, lng })
      return
    }
    
    setIsAddingMarker(true)
    setPendingMarker({ lat, lng })
  }

  const updateCarMarker = (lat: number, lng: number) => {
    if (!mapRef.current || !L) return
    
    // Remove existing car marker
    if (carMarkerRef) {
      mapRef.current.removeLayer(carMarkerRef)
    }
    
    // Create modern car icon
    const carIcon = L.divIcon({
      html: `<div style="
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); 
        border-radius: 50%; 
        width: 36px; 
        height: 36px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        box-shadow: 
          0 4px 20px rgba(220, 38, 38, 0.4),
          0 2px 8px rgba(0, 0, 0, 0.3),
          inset 0 1px 1px rgba(255, 255, 255, 0.2);
        font-size: 18px;
        position: relative;
        backdrop-filter: blur(10px);
      ">
        <div style="
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        ">🚗</div>
      </div>`,
      className: 'car-location-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
    
    const marker = L.marker([lat, lng], { icon: carIcon })
      .addTo(mapRef.current)
      .bindPopup(`
        <div style="
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.9) 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 16px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          min-width: 200px;
        ">
          <div style="font-size: 24px; margin-bottom: 8px;">🚗</div>
          <div style="font-weight: 600; font-size: 16px; margin-bottom: 12px;">Din bil är parkerad här</div>
          <button onclick="window.findCarFromPopup()" style="
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            backdrop-filter: blur(5px);
          " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
            Navigera till bil
          </button>
        </div>
      `, {
        closeButton: true,
        className: 'modern-popup'
      })
    
    setCarMarkerRef(marker)
  }

  const findCar = () => {
    if (!carLocation) {
      alert('Ingen bil parkerad! Använd "Parkera bil" först.')
      return
    }

    console.log('Toggling car direction view')
    
    if (showCarDirection) {
      // Turn off car direction
      setShowCarDirection(false)
      if (carDirectionLine && mapRef.current) {
        mapRef.current.removeLayer(carDirectionLine)
        setCarDirectionLine(null)
      }
    } else {
      // Turn on car direction
      setShowCarDirection(true)
      
      // Zoom to car location
      if (mapRef.current) {
        mapRef.current.setView([carLocation.lat, carLocation.lng], 16, {
          animate: true,
          duration: 1
        })
        
        // Show car marker popup
        if (carMarkerRef) {
          carMarkerRef.openPopup()
        }
      }
      
      // Draw line if user location is available
      updateCarDirectionLine()
    }
  }

  const updateCarDirectionLine = () => {
    if (!carLocation || !userLocation || !mapRef.current || !L || !showCarDirection) {
      return
    }

    // Remove existing line
    if (carDirectionLine) {
      mapRef.current.removeLayer(carDirectionLine)
    }

    // Create line between user and car
    const line = L.polyline(
      [[userLocation.lat, userLocation.lng], [carLocation.lat, carLocation.lng]], 
      {
        color: '#ef4444',
        weight: 5,
        opacity: 0.9,
        dashArray: '12, 6'
      }
    ).addTo(mapRef.current)

    setCarDirectionLine(line)

    // Calculate distance
    const distance = mapRef.current.distance(
      [userLocation.lat, userLocation.lng], 
      [carLocation.lat, carLocation.lng]
    )
    
    console.log(`Distance to car: ${Math.round(distance)}m`)
  }

  // Expose findCar function globally for popup access
  useEffect(() => {
    (window as any).findCarFromPopup = findCar
    return () => {
      delete (window as any).findCarFromPopup
    }
  }, [carLocation, showCarDirection, carDirectionLine])

  const updateWalkingDirectionLine = () => {
    if (!navigationTarget || !userLocation || !mapRef.current || !L || !showWalkingDirection) {
      return
    }

    // Remove existing line
    if (walkingDirectionLine) {
      mapRef.current.removeLayer(walkingDirectionLine)
    }

    // Create line between user and target mushroom
    const line = L.polyline(
      [[userLocation.lat, userLocation.lng], [navigationTarget.lat, navigationTarget.lng]], 
      {
        color: '#22c55e',
        weight: 5,
        opacity: 0.9,
        dashArray: '10, 4'
      }
    ).addTo(mapRef.current)

    setWalkingDirectionLine(line)

    // Calculate and update current distance
    const distance = calculateDistance(
      userLocation.lat, 
      userLocation.lng, 
      navigationTarget.lat, 
      navigationTarget.lng
    )
    setCurrentNavigationDistance(distance)
  }

  const hideWalkingDirection = () => {
    if (walkingDirectionLine && mapRef.current) {
      mapRef.current.removeLayer(walkingDirectionLine)
    }
    setWalkingDirectionLine(null)
    setShowWalkingDirection(false)
    setNavigationTarget(null)
    setCurrentNavigationDistance(null)
  }

  // Update car direction line when user location changes
  useEffect(() => {
    if (showCarDirection && userLocation && carLocation) {
      updateCarDirectionLine()
    }
  }, [userLocation, showCarDirection, carLocation])

  // Update walking direction line when user location changes
  useEffect(() => {
    if (showWalkingDirection && userLocation && navigationTarget) {
      updateWalkingDirectionLine()
    }
  }, [userLocation, showWalkingDirection, navigationTarget])

  const removeCar = () => {
    if (carMarkerRef && mapRef.current) {
      mapRef.current.removeLayer(carMarkerRef)
    }
    if (carDirectionLine && mapRef.current) {
      mapRef.current.removeLayer(carDirectionLine)
    }
    setCarLocation(null)
    setCarMarkerRef(null)
    setShowCarDirection(false)
    setCarDirectionLine(null)
    setShowCarControls(false)
    localStorage.removeItem('svampkartan-car-location')
  }

  const closeCarControls = () => {
    setShowCarControls(false)
    if (showCarDirection) {
      setShowCarDirection(false)
      if (carDirectionLine && mapRef.current) {
        mapRef.current.removeLayer(carDirectionLine)
        setCarDirectionLine(null)
      }
    }
  }

  // Auto-request location when map loads
  useEffect(() => {
    if (mapRef.current && L) {
      // Small delay to let map settle
      setTimeout(() => {
        requestLocation()
      }, 1000)
    }
  }, [mapRef.current, L])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationWatch()
    }
  }, [])

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
          
          // Track zoom changes for dynamic marker sizing
          map.on('zoomend', () => {
            setMapZoom(map.getZoom())
          })
          
          // Set initial zoom level
          setMapZoom(map.getZoom())

          // Reposition zoom controls below header
          setTimeout(() => {
            const zoomControl = map.getContainer().querySelector('.leaflet-control-zoom')
            if (zoomControl) {
              (zoomControl as HTMLElement).style.marginTop = '60px'
            }
          }, 100)
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

    // Add markers to map
    markers.forEach(marker => {
      const sizes = getZoomBasedSizes(mapZoom)
      
      // Create modern sleek marker design with dynamic sizing and hover animations
      const mushroomIcon = L.divIcon({
        html: `
          <style>
            .mushroom-marker {
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .mushroom-marker:hover {
              transform: translateY(-50%) scale(1.05);
              filter: drop-shadow(0 12px 24px rgba(0,0,0,0.25));
            }
            .mushroom-marker:hover .marker-content {
              box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.12),
                0 2px 8px rgba(16, 185, 129, 0.15),
                inset 0 1px 1px rgba(255, 255, 255, 0.95),
                inset 0 -1px 1px rgba(16, 185, 129, 0.03);
            }
          </style>
          <div class="mushroom-marker" style="
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            cursor: pointer;
            transform: translateY(-50%);
            filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));
          ">
            <!-- Modern Pin with integrated info -->
            <div class="marker-content" style="
              background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.95) 0%, 
                rgba(248, 250, 252, 0.9) 50%,
                rgba(236, 253, 245, 0.85) 100%);
              border: 1px solid rgba(16, 185, 129, 0.15);
              border-radius: 18px;
              padding: ${sizes.padding}px 14px;
              position: relative;
              min-width: ${sizes.minWidth}px;
              max-width: ${sizes.maxWidth}px;
              backdrop-filter: blur(20px) saturate(180%);
              box-shadow: 
                0 4px 20px rgba(0, 0, 0, 0.08),
                0 1px 4px rgba(16, 185, 129, 0.08),
                inset 0 1px 1px rgba(255, 255, 255, 0.9),
                inset 0 -1px 1px rgba(16, 185, 129, 0.02);
              transform: perspective(100px) rotateX(2deg);
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            ">
              <!-- Subtle top highlight -->
              <div style="
                position: absolute;
                top: 1px;
                left: 8px;
                right: 8px;
                height: 1px;
                background: linear-gradient(90deg, 
                  transparent 0%, 
                  rgba(255,255,255,0.5) 50%, 
                  transparent 100%);
                border-radius: 1px;
              "></div>
              
              <!-- Name with modern typography -->
              <div style="
                font-size: ${sizes.fontSize}px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 6px;
                letter-spacing: -0.3px;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-shadow: 0 1px 2px rgba(255,255,255,0.8);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
              ">${marker.name}</div>
              
              <!-- Modern abundance indicator -->
              <div style="
                display: flex;
                justify-content: center;
                gap: 3px;
                margin-bottom: 2px;
              ">
                ${Array.from({length: 5}, (_, i) => `
                  <div style="
                    width: ${sizes.dotSize}px;
                    height: ${sizes.dotSize}px;
                    border-radius: 50%;
                    background: ${i < (marker.abundance || 3) 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
                    box-shadow: ${i < (marker.abundance || 3) 
                      ? '0 1px 3px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255,255,255,0.3)' 
                      : '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)'};
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                  "></div>
                `).join('')}
              </div>
              
              <!-- Modern pointer tail with depth -->
              <div style="
                position: absolute;
                bottom: -9px;
                left: 50%;
                transform: translateX(-50%);
                width: 16px;
                height: 16px;
                background: linear-gradient(135deg, 
                  rgba(255, 255, 255, 0.95) 0%, 
                  rgba(236, 253, 245, 0.85) 100%);
                border: 1px solid rgba(16, 185, 129, 0.15);
                border-top: none;
                border-left: none;
                transform: translateX(-50%) rotate(45deg);
                box-shadow: 
                  2px 2px 4px rgba(0, 0, 0, 0.06),
                  inset -1px -1px 1px rgba(255, 255, 255, 0.8);
              "></div>
            </div>
            
            <!-- Enhanced pin point -->
            <div style="
              width: ${sizes.pinSize}px;
              height: ${sizes.pinSize}px;
              background: linear-gradient(135deg, #8b5a2b 0%, #a0522d 100%);
              border: 3px solid rgba(255, 255, 255, 0.95);
              border-radius: 50%;
              box-shadow: 
                0 4px 12px rgba(139, 90, 43, 0.25),
                0 2px 4px rgba(0, 0, 0, 0.1),
                inset 0 1px 1px rgba(255, 255, 255, 0.3);
              margin-top: 2px;
              position: relative;
            ">
              <!-- Inner highlight -->
              <div style="
                position: absolute;
                top: 1px;
                left: 1px;
                width: 4px;
                height: 4px;
                background: rgba(255, 255, 255, 0.4);
                border-radius: 50%;
              "></div>
            </div>
          </div>
        `,
        className: 'mushroom-icon-with-label',
        iconSize: [sizes.maxWidth, 60], // Dynamic width to accommodate different zoom levels
        iconAnchor: [sizes.maxWidth / 2, 30] // Center the icon
      })
      
      const leafletMarker = L.marker([marker.lat, marker.lng], { icon: mushroomIcon })
      
      // Add click handler to open marker details with navigation options
      leafletMarker.on('click', () => {
        setSelectedMarker(marker)
      })
      
      markersLayerRef.current?.addLayer(leafletMarker)
    })
  }, [markers, L, mapZoom])

  // Handle map clicks for adding markers
  useEffect(() => {
    if (!mapRef.current || !L) return

    const handleMapClick = (e: any) => {
      if (isParkingMode) {
        // Park car at clicked location
        const newCarLocation = { lat: e.latlng.lat, lng: e.latlng.lng }
        setCarLocation(newCarLocation)
        updateCarMarker(e.latlng.lat, e.latlng.lng)
        localStorage.setItem('svampkartan-car-location', JSON.stringify(newCarLocation))
        setIsParkingMode(false)
        return
      }
      
      if (isAddingMarker) {
        setPendingMarker({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    }

    if (isAddingMarker || isParkingMode) {
      mapRef.current.on('click', handleMapClick)
      mapRef.current.getContainer().style.cursor = isParkingMode ? 'crosshair' : 'crosshair'
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
  }, [isAddingMarker, isParkingMode, L])

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

  // Success animation state
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  
  // Navigation animation state
  const [navigationLineAnimated, setNavigationLineAnimated] = useState(false)
  
  // Credits page state
  const [showCredits, setShowCredits] = useState(false)

  const addMarker = () => {
    if (!pendingMarker || !newMarkerForm.name.trim()) return
    
    const newMarker: MushroomMarker = {
      id: Date.now(),
      name: newMarkerForm.name,
      lat: pendingMarker.lat,
      lng: pendingMarker.lng,
      date: new Date().toISOString().split('T')[0],
      notes: newMarkerForm.notes,
      abundance: newMarkerForm.abundance
    }
    
    setMarkers([...markers, newMarker])
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '', abundance: 3 })
    
    // Show success animation
    setShowSuccessAnimation(true)
    setTimeout(() => setShowSuccessAnimation(false), 2000)
  }

  const useCurrentPosition = () => {
    setShowAddChoiceDialog(false)
    if (userLocation) {
      setPendingMarker({ lat: userLocation.lat, lng: userLocation.lng })
    } else {
      // Request location if not available
      requestLocation()
      // Set a timeout to check if location is available
      setTimeout(() => {
        const currentLocation = userLocation
        if (currentLocation) {
          setPendingMarker({ lat: currentLocation.lat, lng: currentLocation.lng })
        } else {
          alert('Kunde inte hämta din position. Klicka på kartan istället.')
          setIsAddingMarker(true)
        }
      }, 2000)
    }
  }

  const useMapClick = () => {
    setShowAddChoiceDialog(false)
    setIsAddingMarker(true)
  }

  const cancelAddChoice = () => {
    setShowAddChoiceDialog(false)
  }

  const cancelAddMarker = () => {
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '', abundance: 3 })
  }

  const handleDeleteMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id))
    setSelectedMarker(null)
  }

  const handleEditMarker = (marker: MushroomMarker) => {
    setEditForm({ name: marker.name, notes: marker.notes || '', abundance: marker.abundance || 3 })
    setIsEditingMarker(true)
  }

  const saveEditedMarker = () => {
    if (!selectedMarker || !editForm.name.trim()) return
    
    const updatedMarkers = markers.map(marker => 
      marker.id === selectedMarker.id 
        ? { ...marker, name: editForm.name.trim(), notes: editForm.notes.trim(), abundance: editForm.abundance }
        : marker
    )
    
    setMarkers(updatedMarkers)
    setSelectedMarker(null)
    setIsEditingMarker(false)
    setEditForm({ name: '', notes: '', abundance: 3 })
  }

  const cancelEdit = () => {
    setIsEditingMarker(false)
    setEditForm({ name: '', notes: '', abundance: 3 })
  }

  const zoomToUserLocation = () => {
    console.log('Location button clicked!')
    console.log('Current userLocation:', userLocation)
    
    if (userLocation && mapRef.current) {
      console.log('Zooming to user location:', userLocation)
      // Zoom to current user location
      mapRef.current.setView([userLocation.lat, userLocation.lng], 16, {
        animate: true,
        duration: 1
      })
      
      // Show popup on user marker
      mapRef.current.eachLayer((layer: any) => {
        if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-marker') {
          layer.openPopup()
        }
      })
    } else {
      // No location yet, request it
      console.log('No user location available, requesting GPS...')
      requestLocation()
    }
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Modern Glass Header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-r from-green-500/80 to-emerald-600/80 backdrop-blur-md border-b border-white/20 shadow-lg z-[10000]">
        <div className="flex items-center justify-between h-full px-4">
          <h1 className="text-white font-semibold text-lg">Min Svampkarta</h1>
          
          <div className="flex items-center gap-3">
            {/* Enhanced Location Status with Animations */}
            <div className="flex items-center gap-2 text-white text-sm">
              {locationStatus === 'locating' && (
                <>
                  <div className="relative">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-30"></div>
                  </div>
                  <span className="hidden sm:inline animate-pulse">Söker position...</span>
                </>
              )}
              {locationStatus === 'found' && (
                <>
                  <div className="relative animate-bounce">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-20"></div>
                  </div>
                  <span className="hidden sm:inline animate-fadeIn">Position hittad</span>
                </>
              )}
              {locationStatus === 'error' && (
                <>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline animate-shake">Ingen position</span>
                </>
              )}
            </div>
            
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
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-full right-4 mt-1 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 min-w-48 py-2">
            <div className="px-4 py-2 text-gray-600 text-sm border-b border-gray-200/50">
              <div className="font-medium">Meny</div>
            </div>
            <div className="py-1">
              <button 
                onClick={() => {
                  setShowFindsList(true)
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">📋</span>
                <span className="font-medium">Mina fynd</span>
              </button>
            </div>
            <div className="py-1">
              <button 
                onClick={() => {
                  setShowCredits(true)
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">ℹ️</span>
                <span className="font-medium">Om appen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Add Button - Enhanced Animations */}
      <div className="fixed bottom-8 right-8" style={{ zIndex: 10000 }}>
        <div className="relative">
          {/* Pulse ring animation */}
          <div className={`absolute inset-0 rounded-2xl transition-all duration-1000 ${
            !isAddingMarker ? 'animate-ping bg-emerald-400 opacity-20' : ''
          }`}></div>
          
          <button 
            onClick={() => {
              if (isAddingMarker) {
                setIsAddingMarker(false)
                setPendingMarker(null)
              } else {
                setShowAddChoiceDialog(true)
              }
            }}
            className={`relative w-16 h-16 rounded-2xl text-white text-2xl font-light shadow-2xl transition-all duration-300 transform backdrop-blur-sm border border-opacity-20 hover:scale-110 active:scale-95 ${
              isAddingMarker 
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rotate-45 border-red-300 animate-pulse' 
                : 'bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 hover:shadow-3xl border-emerald-300 hover:animate-bounce'
            }`}
            style={{
              boxShadow: isAddingMarker 
                ? '0 20px 40px rgba(239, 68, 68, 0.3), 0 8px 16px rgba(239, 68, 68, 0.2)' 
                : '0 20px 40px rgba(16, 185, 129, 0.3), 0 8px 16px rgba(16, 185, 129, 0.2)',
              animation: !isAddingMarker ? 'float 3s ease-in-out infinite' : ''
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
      </div>

      {/* Floating Car Controls */}
      <div className="fixed bottom-28 right-8" style={{ zIndex: 10000 }}>
        {/* Main Car Button */}
        <button 
          onClick={toggleCarControls}
          className={`relative w-12 h-12 rounded-full shadow-lg transition-all duration-300 border-2 flex items-center justify-center ${
            isParkingMode 
              ? 'bg-red-500 border-red-300 animate-pulse shadow-red-500/30' 
              : carLocation
                ? showCarControls
                  ? 'bg-emerald-500 border-emerald-300 shadow-emerald-500/30'
                  : 'bg-blue-500 border-blue-300 shadow-blue-500/30 hover:shadow-blue-500/50'
                : 'bg-red-500 border-red-300 shadow-red-500/30 hover:shadow-red-500/50'
          } active:scale-95`}
          title={
            isParkingMode ? "Avbryt parkering" :
            carLocation ? (showCarControls ? "Stäng bilkontroller" : "Öppna bilkontroller") : 
            "Parkera bil"
          }
        >
          <span className="text-lg leading-none">
            {isParkingMode ? '❌' : '🚗'}
          </span>
        </button>

        {/* Car Control Panel - only show when car is parked and controls are open */}
        {carLocation && showCarControls && (
          <div className="absolute bottom-0 right-16 flex flex-row gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
            {/* Find Car Button */}
            <button 
              onClick={findCar}
              className={`w-10 h-10 rounded-full shadow-md transition-all duration-200 border-2 flex items-center justify-center active:scale-90 ${
                showCarDirection 
                  ? 'bg-green-500 border-green-300 shadow-green-500/40 animate-pulse' 
                  : 'bg-blue-500 border-blue-300 shadow-blue-500/30 hover:shadow-blue-500/50'
              }`}
              title={showCarDirection ? 'Dölj riktning till bil' : 'Visa riktning till bil'}
            >
              <span className="text-sm leading-none">🔍</span>
            </button>

            {/* Remove Car Button */}
            <button 
              onClick={removeCar}
              className="w-10 h-10 rounded-full shadow-md transition-all duration-200 border-2 bg-red-600 border-red-400 shadow-red-600/30 hover:shadow-red-600/50 active:scale-90 flex items-center justify-center"
              title="Ta bort bil helt"
            >
              <span className="text-sm leading-none">🗑️</span>
            </button>
          </div>
        )}
      </div>

      {/* Beautiful Parking Dialog */}
      {showParkingDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 max-w-sm w-full border border-white/20 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🚗</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Parkera bil</h3>
              <p className="text-gray-600 text-sm">Välj var din bil står</p>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {/* Current Location Option */}
              <button
                onClick={parkAtCurrentLocation}
                disabled={!userLocation}
                className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 ${
                  userLocation 
                    ? 'bg-blue-500 border-blue-400 text-white hover:bg-blue-600 active:scale-95' 
                    : 'bg-gray-300 border-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xl">📍</span>
                  <div className="text-left">
                    <div className="font-medium">Här jag står nu</div>
                    <div className="text-sm opacity-80">
                      {userLocation ? 'Använd min GPS-position' : 'GPS ej tillgänglig'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Custom Location Option */}
              <button
                onClick={parkAtCustomLocation}
                className="w-full p-4 rounded-2xl border-2 bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600 active:scale-95 transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xl">🎯</span>
                  <div className="text-left">
                    <div className="font-medium">Välj på kartan</div>
                    <div className="text-sm opacity-80">Klicka var bilen står</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowParkingDialog(false)}
              className="w-full p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Finds List Modal */}
      {showFindsList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Mina svampfynd</h3>
              <button
                onClick={() => setShowFindsList(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh]">
              {markers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🍄</div>
                  <p>Inga svampfynd registrerade än</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {markers
                    .map((marker) => ({
                      ...marker,
                      distance: userLocation 
                        ? calculateDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng)
                        : null
                    }))
                    .sort((a, b) => {
                      if (!a.distance && !b.distance) return 0
                      if (!a.distance) return 1
                      if (!b.distance) return -1
                      return a.distance - b.distance
                    })
                    .map((marker) => {
                    return (
                      <div key={marker.id} className="bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                        <button
                          onClick={() => {
                            if (mapRef.current) {
                              mapRef.current.setView([marker.lat, marker.lng], 15)
                              setShowFindsList(false)
                            }
                          }}
                          className="w-full p-3 text-left"
                        >
                          <div className="flex items-center justify-between">
                            {/* Left side - Name and abundance on same row */}
                            <div className="flex items-center gap-3 flex-1">
                              <span className="font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                                {marker.name}
                              </span>
                              <div className="flex items-center gap-1">
                                {Array.from({length: 5}, (_, i) => (
                                  <div 
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      i < (marker.abundance || 3) ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {/* Right side - Distance */}
                            <div className="text-right">
                              {marker.distance !== null ? (
                                <span className="text-sm font-medium text-blue-600">
                                  {formatDistance(marker.distance)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Okänt avstånd</span>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {!userLocation && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-yellow-700">
                  💡 Aktivera platsåtkomst för att se avstånd till svampfynd
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Options Dialog */}
      {showNavigationDialog && navigationTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🧭</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Navigera till</h3>
              <p className="text-lg text-gray-600">{navigationTarget.name}</p>
              {userLocation && (
                <p className="text-sm text-gray-500 mt-1">
                  {formatDistance(calculateDistance(userLocation.lat, userLocation.lng, navigationTarget.lat, navigationTarget.lng))} bort
                </p>
              )}
            </div>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setShowMapsConfirmation(true)
                  setShowNavigationDialog(false)
                }}
                className="w-full p-4 rounded-xl bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">🚗</span>
                <span className="font-medium">Navigera med bil</span>
              </button>
              
              <button
                onClick={() => {
                  if (!userLocation) {
                    alert('Din position krävs för att visa riktning. Aktivera GPS först.')
                    return
                  }
                  setShowWalkingDirection(true)
                  setShowNavigationDialog(false)
                  updateWalkingDirectionLine()
                }}
                className="w-full p-4 rounded-xl bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">🚶</span>
                <span className="font-medium">Navigera till fots</span>
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowNavigationDialog(false)
                setNavigationTarget(null)
                if (showWalkingDirection) {
                  hideWalkingDirection()
                }
              }}
              className="w-full p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Google Maps Confirmation Dialog */}
      {showMapsConfirmation && navigationTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🗺️</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Öppna Google Maps</h3>
              <p className="text-gray-600">Vill du öppna Google Maps för bilnavigation till {navigationTarget.name}?</p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  navigateToMarker(navigationTarget, 'driving')
                  setShowMapsConfirmation(false)
                }}
                className="w-full p-4 rounded-xl bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all duration-200"
              >
                Ja, öppna Google Maps
              </button>
              
              <button
                onClick={() => setShowMapsConfirmation(false)}
                className="w-full p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Location Button */}
      <div className="fixed bottom-44 right-8" style={{ zIndex: 10000 }}>
        <button 
          onClick={zoomToUserLocation}
          className="w-12 h-12 rounded-full shadow-lg transition-all duration-300 border-2 bg-blue-500 border-blue-300 shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-95 flex items-center justify-center"
          title="Hitta min position"
        >
          <span className="text-lg leading-none">📍</span>
        </button>
      </div>

      {/* Walking Navigation Cancel Button - centered at bottom when walking direction is active */}
      {showWalkingDirection && navigationTarget && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2" style={{ zIndex: 10000 }}>
          <button 
            onClick={hideWalkingDirection}
            className="px-6 py-3 rounded-full shadow-lg transition-all duration-300 border-2 bg-red-500 border-red-300 text-white font-medium hover:bg-red-600 active:scale-95"
          >
            Avbryt navigering
          </button>
        </div>
      )}

      {/* Walking Navigation Distance Display */}
      {showWalkingDirection && navigationTarget && currentNavigationDistance !== null && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2" style={{ zIndex: 10000 }}>
          <div className="bg-white/95 backdrop-blur-md rounded-2xl px-6 py-3 shadow-lg border border-green-200">
            <div className="flex items-center gap-3">
              <span className="text-lg">🚶</span>
              <div className="text-center">
                <div className="text-sm text-gray-600 font-medium">Navigerar till</div>
                <div className="text-lg font-bold text-green-700">{navigationTarget.name}</div>
                <div className="text-xl font-bold text-green-800">{formatDistance(currentNavigationDistance)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mängd svamp
                </label>
                <div className="flex justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewMarkerForm({ ...newMarkerForm, abundance: value })}
                      className={`text-2xl p-1 rounded transition-all ${
                        newMarkerForm.abundance >= value 
                          ? 'opacity-100 scale-110' 
                          : 'opacity-30 hover:opacity-60'
                      }`}
                    >
                      🍄
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">
                  {newMarkerForm.abundance === 1 && "Mycket lite"}
                  {newMarkerForm.abundance === 2 && "Lite"}
                  {newMarkerForm.abundance === 3 && "Måttligt"}
                  {newMarkerForm.abundance === 4 && "Mycket"}
                  {newMarkerForm.abundance === 5 && "Extremt mycket"}
                </p>
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
                  <p className="text-sm text-gray-600 flex items-center mb-2">
                    <span className="mr-2">📅</span>
                    {selectedMarker.date}
                  </p>
                  
                  {/* Abundance Rating */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">MÄNGD:</span>
                    <div className="flex items-center gap-1">
                      {Array.from({length: 5}, (_, i) => (
                        <div 
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full ${
                            i < (selectedMarker.abundance || 3) ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs text-gray-600 ml-2">
                        {selectedMarker.abundance === 1 && "Mycket lite"}
                        {selectedMarker.abundance === 2 && "Lite"}
                        {(selectedMarker.abundance === 3 || !selectedMarker.abundance) && "Måttligt"}
                        {selectedMarker.abundance === 4 && "Mycket"}
                        {selectedMarker.abundance === 5 && "Extremt mycket"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteMarker(selectedMarker.id)}
                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                  title="Ta bort fynd"
                >
                  <span className="text-lg">🗑️</span>
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

              {/* Navigation Buttons */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-3 font-medium">NAVIGERA TILL PLATSEN</p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setNavigationTarget(selectedMarker)
                      setShowMapsConfirmation(true)
                      setSelectedMarker(null)
                    }}
                    className="w-full p-3 rounded-xl bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <span className="text-lg">🚗</span>
                    <span className="font-medium">Navigera med bil</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!userLocation) {
                        alert('Din position krävs för att visa riktning. Aktivera GPS först.')
                        return
                      }
                      setNavigationTarget(selectedMarker)
                      setShowWalkingDirection(true)
                      setSelectedMarker(null)
                      setNavigationLineAnimated(true)
                      setTimeout(() => setNavigationLineAnimated(false), 1000)
                      // Use setTimeout to ensure state is updated before calling the function
                      setTimeout(() => {
                        updateWalkingDirectionLine()
                      }, 10)
                    }}
                    className="w-full p-3 rounded-xl bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <span className="text-lg">🚶</span>
                    <span className="font-medium">Navigera till fots</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-medium shadow-lg hover:from-gray-500 hover:to-gray-600 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Stäng
                </button>
                <button
                  onClick={() => handleEditMarker(selectedMarker)}
                  className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Redigera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Marker Modal */}
      {isEditingMarker && selectedMarker && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 10002 }}
          onClick={cancelEdit}
        >
          <div 
            className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-sm w-full border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Redigera fynd
                </h3>
                <button
                  onClick={cancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Edit Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Svampart
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="t.ex. Kantarell"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anteckningar
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder="Frivilliga anteckningar..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mängd svamp
                  </label>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, abundance: value })}
                        className={`text-2xl p-1 rounded transition-all ${
                          editForm.abundance >= value 
                            ? 'opacity-100 scale-110' 
                            : 'opacity-30 hover:opacity-60'
                        }`}
                      >
                        🍄
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {editForm.abundance === 1 && "Mycket lite"}
                    {editForm.abundance === 2 && "Lite"}
                    {editForm.abundance === 3 && "Måttligt"}
                    {editForm.abundance === 4 && "Mycket"}
                    {editForm.abundance === 5 && "Extremt mycket"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelEdit}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-medium shadow-lg hover:from-gray-500 hover:to-gray-600 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveEditedMarker}
                  disabled={!editForm.name.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-[1.02] disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Spara
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Choice Dialog */}
      {showAddChoiceDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10001 }}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full m-4 shadow-2xl">
            <h3 className="text-xl font-semibold mb-4 text-center">Lägg till svampfynd</h3>
            <p className="text-gray-600 mb-6 text-center">Hur vill du välja position för fyndet?</p>
            
            <div className="space-y-3">
              <button 
                onClick={useCurrentPosition}
                className="w-full bg-emerald-500 text-white py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
              >
                <span>📍</span>
                Använd min position
              </button>
              
              <button 
                onClick={useMapClick}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
              >
                <span>🗺️</span>
                Klicka på kartan
              </button>
              
              <button 
                onClick={cancelAddChoice}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation Animation */}
      {navigationLineAnimated && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-fadeIn" style={{ zIndex: 10002 }}>
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 transform animate-pulse">
            <div className="text-xl animate-spin">🧭</div>
            <span className="font-semibold">Navigation startad!</span>
            <div className="absolute -inset-1 bg-green-400 rounded-full animate-ping opacity-30"></div>
          </div>
        </div>
      )}

      {/* Success Animation */}
      {showSuccessAnimation && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-fadeIn" style={{ zIndex: 10002 }}>
          <div className="bg-emerald-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 transform animate-bounce">
            <div className="text-2xl animate-spin">🍄</div>
            <span className="font-semibold text-lg">Svampfynd tillagt!</span>
            <div className="absolute -inset-1 bg-emerald-400 rounded-full animate-ping opacity-30"></div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 10003 }}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all">
            <div className="text-center">
              {/* App Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <span className="text-3xl">🍄</span>
              </div>
              
              {/* App Name */}
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Min Svampkarta</h2>
              <p className="text-gray-500 mb-8 text-sm">Din personliga svampfyndskarta</p>
              
              {/* Developer Info */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Utvecklad av</h3>
                <p className="text-lg font-medium text-gray-700 mb-2">Jesper Holmstedt</p>
                <a 
                  href="mailto:jesperholmstedt@gmail.com" 
                  className="text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
                >
                  jesperholmstedt@gmail.com
                </a>
              </div>
              
              {/* Close Button */}
              <button 
                onClick={() => setShowCredits(false)}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
