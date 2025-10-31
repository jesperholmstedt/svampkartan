"use client";
import { Geolocation } from '@capacitor/geolocation';

// Extend Window type to include Capacitor (for TypeScript)
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      [key: string]: any;
    };
  }
}

// Utility to check if running in a web browser or native
const isNative = typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() === true);

import { useState, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface MushroomMarker {
  id: number
  name: string
  lat: number
  lng: number
  date: string
  notes?: string
  abundance: number // 1-5 scale (1=few, 5=many)
  category: string // Mushroom category for organization
}

// Available mushroom categories
const DEFAULT_CATEGORIES = [
  { id: 'unknown', name: 'Allmänt', emoji: '⭐', color: 'gray' },
  { id: 'mushroom', name: 'Svamp', emoji: '🍄‍🟫', color: 'green' },
  { id: 'berries', name: 'Bär', emoji: '🍓', color: 'purple' },

] as const

interface MapComponentProps {
  className?: string
}

export default function MapComponent({ className = '' }: MapComponentProps) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<any>(null)
  // Movement thresholds (tweak these to reduce false positives)
  const MOVEMENT_THRESHOLD_METERS = 0.3 // require 0.3 meter (mycket känsligare)
  const SPEED_THRESHOLD_MS = 0.1 // require ~0.1 m/s (~0.36 km/h) (mycket känsligare)
  // ...alla useState och useRef deklarationer...

  // Ref to track if user is manually panning the map (prevents auto-centering during navigation)
  const isUserPanning = useRef(false)

  // ...alla useState och useRef deklarationer...
  const userArrowOverlayRef = useRef<SVGElement | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [L, setL] = useState<any>(null)

  // Attach event listener to map to detect manual panning
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleMoveStart = () => {
      isUserPanning.current = true;
    };
    map.on && map.on('movestart', handleMoveStart);
    return () => {
      map.off && map.off('movestart', handleMoveStart);
    };
  }, [isMapLoaded]);

  // Reset isUserPanning when navigation target changes (so auto-centering works at navigation start)
  // Placera denna hook EFTER att navigationTarget deklarerats
  
  // Initialize categories with defaults + any custom ones from localStorage
  const [categories, setCategories] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svampkartan-categories')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Backwards compatible: old format saved as array of custom categories
          if (Array.isArray(parsed)) {
            return [...DEFAULT_CATEGORIES, ...parsed.filter((cat: any) => !DEFAULT_CATEGORIES.find(def => def.id === cat.id))]
          }

          // New format: { customCategories: [...], removedDefaults: [...] }
          if (parsed && parsed.customCategories) {
            const removed = parsed.removedDefaults || []
            // Start from defaults excluding removed ones
            const base = DEFAULT_CATEGORIES.filter(def => !removed.includes(def.id))
            // Merge customCategories: override defaults or append new
            const combined: any[] = [...base]
            parsed.customCategories.forEach((c: any) => {
              const idx = combined.findIndex(x => x.id === c.id)
              if (idx >= 0) combined[idx] = c
              else combined.push(c)
            })
            return combined
          }
        } catch {
          return [...DEFAULT_CATEGORIES]
        }
      }
    }
    return [...DEFAULT_CATEGORIES]
  })
  
  const [markers, setMarkers] = useState<MushroomMarker[]>([])
  const [selectedMarker, setSelectedMarker] = useState<MushroomMarker | null>(null)
  // Whether the marker details modal should be shown. Keep selection separate from modal visibility so
  // we can select a marker (to force it to render on the map) without opening the details modal.
  const [showMarkerDetails, setShowMarkerDetails] = useState(false)
  const [isAddingMarker, setIsAddingMarker] = useState(false)
  const [newMarkerForm, setNewMarkerForm] = useState({ name: '', notes: '', abundance: 3, category: 'unknown' })
  const [pendingMarker, setPendingMarker] = useState<{lat: number, lng: number} | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  // Modal state for Karttyp selection
  const [showMapTypeModal, setShowMapTypeModal] = useState(false)
  // (remove dropdown state) const [showMapTypeDropdown, setShowMapTypeDropdown] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const [userSpeed, setUserSpeed] = useState<number | null>(null)
  const [carLocation, setCarLocation] = useState<{lat: number, lng: number} | null>(null)
  const [carMarkerRef, setCarMarkerRef] = useState<any>(null)
  const [showCarDirection, setShowCarDirection] = useState(false)
  const [carDirectionLine, setCarDirectionLine] = useState<any>(null)
  const [isParkingMode, setIsParkingMode] = useState(false)
  const [showCarControls, setShowCarControls] = useState(false)
  const [showParkingDialog, setShowParkingDialog] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('')
  // watchId can be number (web) or string (native)
  const [watchId, setWatchId] = useState<number | string | null>(null)
  const [showFindsList, setShowFindsList] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showNavigationDialog, setShowNavigationDialog] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState<MushroomMarker | null>(null)

  // Reset isUserPanning when navigation target changes (so auto-centering works at navigation start)
  useEffect(() => {
    isUserPanning.current = false;
  }, [navigationTarget]);
  const [showWalkingDirection, setShowWalkingDirection] = useState(false)
  const [walkingDirectionLine, setWalkingDirectionLine] = useState<any>(null)
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false)
  
  // Measuring tool state
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<{lat: number, lng: number}[]>([])
  const [measurePolyline, setMeasurePolyline] = useState<any>(null)
  const [measureMarkers, setMeasureMarkers] = useState<any[]>([])
  const [showMeasureComplete, setShowMeasureComplete] = useState(false)
  const [measureRouteName, setMeasureRouteName] = useState('Min rutt')
  const [totalMeasureDistance, setTotalMeasureDistance] = useState(0)
  // Attach event listener to map to detect manual panning
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleMoveStart = () => {
      isUserPanning.current = true;
    };
    map.on && map.on('movestart', handleMoveStart);
    return () => {
      map.off && map.off('movestart', handleMoveStart);
    };
  }, [isMapLoaded]);

  // Reset isUserPanning when navigation target changes (so auto-centering works at navigation start)
  useEffect(() => {
    isUserPanning.current = false;
  }, [navigationTarget]);
  const [currentMapType, setCurrentMapType] = useState<'mml-topo' | 'mml-satellite' | 'opentopo' | 'lantmateriet' | 'lantmateriet-satellite'>(() => {
    // Load saved map type from localStorage, default to 'opentopo' if not found
    // Only access localStorage in the browser (not during SSR)
    if (typeof window !== 'undefined') {
      try {
        const savedMapType = localStorage.getItem('svampkartan-map-type')
        if (savedMapType && ['mml-topo', 'mml-satellite', 'opentopo', 'lantmateriet', 'lantmateriet-satellite'].includes(savedMapType)) {
          return savedMapType as 'mml-topo' | 'mml-satellite' | 'opentopo' | 'lantmateriet' | 'lantmateriet-satellite'
        }
      } catch (error) {
        console.log('Could not load saved map type:', error)
      }
    }
    return 'opentopo'
  })
  const [showMapSelector, setShowMapSelector] = useState(false)
  const [currentNavigationDistance, setCurrentNavigationDistance] = useState<number | null>(null)
  const [currentCarDistance, setCurrentCarDistance] = useState<number | null>(null)
  const [isEditingMarker, setIsEditingMarker] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', notes: '', abundance: 3, category: 'edible' })
  const [mapZoom, setMapZoom] = useState(13) // Track map zoom level
  const [showAddChoiceDialog, setShowAddChoiceDialog] = useState(false) // New choice dialog

  // Category management state
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', emoji: '🍄' })
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // --- KATEGORIFILTER FÖR KARTA ---
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  // Helper: returnera alla kategori-id (default: alla syns)
  const getAllCategoryIds = (cats: {id: string}[]) => cats.map(cat => cat.id);
  
  // State: vilka kategorier ska synas på kartan?
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>(() => getAllCategoryIds(categories));
  
  // Om kategorier ändras (t.ex. ny kategori), visa alla som default
  useEffect(() => {
    setVisibleCategoryIds(getAllCategoryIds(categories));
  }, [categories.length]);

  // When selectedMarker is cleared from other actions, ensure showMarkerDetails is also cleared
  useEffect(() => {
    if (!selectedMarker) setShowMarkerDetails(false)
  }, [selectedMarker])

  // Ref to track if user is manually panning the map (prevents auto-centering during navigation)

  // Attach event listener to map to detect manual panning
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleMoveStart = () => {
    };
    map.on && map.on('movestart', handleMoveStart);
    return () => {
      map.off && map.off('movestart', handleMoveStart);
    };
  }, [isMapLoaded]);

  useEffect(() => {
  }, [navigationTarget]);

  // Welcome popup state (only show once)
  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcomePopup')
      if (!hasSeenWelcome) {
        setShowWelcome(true)
        localStorage.setItem('hasSeenWelcomePopup', 'true')
      }
    }
  }, [])

  // Calculate dynamic sizes based on zoom level
  const getZoomBasedSizes = (zoom: number) => {
    // Base sizes at zoom level 13
    const baseZoom = 13
    const scaleFactor = Math.pow(1.15, zoom - baseZoom) // 15% increase per zoom level
    
    return {
      fontSize: Math.max(10, Math.min(16, 13 * scaleFactor)),
      padding: Math.max(2, Math.min(6, 4 * scaleFactor)), // Much smaller padding for compact boxes
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
    // Initial load from localStorage (only once)
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

  // SAFEGUARD: Om carLocation blir null men localStorage har bil, återställ automatiskt
  useEffect(() => {
    const interval = setInterval(() => {
      const saved = localStorage.getItem('svampkartan-car-location')
      if (!carLocation && saved) {
        try {
          setCarLocation(JSON.parse(saved))
        } catch {}
      }
    }, 2000)
    return () => clearInterval(interval)
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
  const requestLocation = async () => {
    setLocationStatus('locating');
    try {
      if (isNative) {
        // Native/Capacitor: Request permissions first
        console.log('Requesting location permissions...');
        const permission = await Geolocation.requestPermissions();
        console.log('Permission result:', permission);

        if (permission.location !== 'granted') {
          throw new Error('Location permission denied');
        }
      }

      if (!isNative && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        // Web: Check permissions if available
        if (navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          console.log('Web permission status:', permission.state);
          if (permission.state === 'denied') {
            throw new Error('Location permission denied');
          }
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log('Got precise location (web):', latitude, longitude, 'accuracy:', accuracy);
            setUserLocation({ lat: latitude, lng: longitude });
            setLocationStatus('found');
            setUserSpeed(position.coords.speed ?? null);
            // Use device-provided heading if available
            if (typeof position.coords.heading === 'number' && !isNaN(position.coords.heading)) {
              setUserHeading(position.coords.heading)
            }
            updateUserMarker(latitude, longitude);
            if (mapRef.current) {
              mapRef.current.setView([latitude, longitude], 15, {
                animate: true,
                duration: 1
              });
            }
            startLocationWatch();
          },
          (error) => {
            console.log('Geolocation error (web):', error.message);
            handleLocationError(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,    // 10 sekunder timeout för initial position
            maximumAge: 5000   // Accept positions up to 5 seconds old
          }
        );
      } else {
        // Native/Capacitor
        console.log('Getting current position (native)...');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000 // 10 sekunder timeout för initial position
        });
        const { latitude, longitude, accuracy } = position.coords;
        console.log('Got precise location (native):', latitude, longitude, 'accuracy:', accuracy);
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationStatus('found');
        setUserSpeed(position.coords.speed ?? null);
        updateUserMarker(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15, {
            animate: true,
            duration: 1
          });
        }
        startLocationWatch();
      }
    } catch (error: any) {
      console.log('Geolocation error:', error.message);
      handleLocationError(error);
    }
  }

  const startLocationWatch = () => {
    if (!watchId) {
      if (!isNative && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log('Location update (web):', latitude, longitude, 'accuracy:', accuracy);
            setUserLocation({ lat: latitude, lng: longitude });
            setUserSpeed(position.coords.speed ?? null);
            if (typeof position.coords.heading === 'number' && !isNaN(position.coords.heading)) {
              setUserHeading(position.coords.heading)
            }
            updateUserMarker(latitude, longitude);
          },
          (error) => {
            console.log('watchPosition error (web):', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,     // Minska timeout till 5 sekunder
            maximumAge: 1000   // Acceptera bara positioner max 1 sekund gamla
          }
        );
        setWatchId(id);
      } else {
        Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 5000       // Minska timeout till 5 sekunder för snabbare uppdateringar
        }, (position, error) => {
          if (position) {
            const { latitude, longitude, accuracy } = position.coords;
            console.log('Location update (native):', latitude, longitude, 'accuracy:', accuracy);
            setUserLocation({ lat: latitude, lng: longitude });
            setUserSpeed(position.coords.speed ?? null);
            updateUserMarker(latitude, longitude);
          }
          if (error) {
            console.log('watchPosition error (native):', error);
          }
        }).then((id: string) => setWatchId(id));
      }
    }
  }

  const stopLocationWatch = () => {
    if (watchId !== null) {
      if (!isNative && typeof navigator !== 'undefined' && 'geolocation' in navigator && typeof watchId === 'number') {
        navigator.geolocation.clearWatch(watchId);
      } else if (typeof watchId === 'string') {
        Geolocation.clearWatch({ id: watchId });
      }
      setWatchId(null);
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

  // Helper to calculate heading in degrees from two lat/lng points
  function calculateHeading(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  // Store previous user location for heading calculation
  const prevUserLocation = useRef<{lat: number, lng: number} | null>(null);
  // Track timestamp of last significant movement to debounce GPS jitter
  const lastMovementTs = useRef<number | null>(null);
  // Smoothed heading to reduce jitter when rotating arrow
  const smoothedHeadingRef = useRef<number | null>(null);
  // Movement streak counter: require multiple consecutive movement detections to confirm movement
  const movementStreakRef = useRef<number>(0);
  const lastMovementDetectionTs = useRef<number | null>(null);
  // Track whether the map is currently being interacted with (zoom/pan) to avoid treating UI interactions as movement
  const mapIsInteractingRef = useRef<boolean>(false);
  // Timestamp of last map interaction end/start to provide a short buffer window
  const mapLastInteractionTs = useRef<number | null>(null);
  const MAP_INTERACTION_BUFFER_MS = 500; // treat updates within 500ms of interaction as part of interaction

  const updateUserMarker = (lat: number, lng: number) => {
    if (!mapRef.current || !L) return;

    // Remove existing user marker
    mapRef.current.eachLayer((layer: any) => {
      if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-marker') {
        mapRef.current.removeLayer(layer);
      }
    });

    // Calculate heading if previous location exists and movement is significant
    let heading: number | null = null;
    const prev = prevUserLocation.current;
    const distKm = prev ? calculateDistance(prev.lat, prev.lng, lat, lng) : 0;
    const distMeters = distKm * 1000;
  // Consider a significant movement to avoid jitter. Use configured thresholds.
  const movementThresholdMeters = MOVEMENT_THRESHOLD_METERS;
  const speedThreshold = SPEED_THRESHOLD_MS;
    // If the user is interacting with the map (zooming/panning), or we're within a short buffer after interaction,
    // do not treat that as movement. This prevents quick GPS updates arriving right after zoom from triggering the arrow.
    const nowTs = Date.now()
    const lastInteraction = mapLastInteractionTs.current
    const withinBuffer = lastInteraction !== null && (nowTs - lastInteraction <= MAP_INTERACTION_BUFFER_MS)
    let isMovingByDistance = false
    let isMovingBySpeed = false
    if (!mapIsInteractingRef.current && !withinBuffer) {
      const detectedByDistance = !!prev && distMeters >= movementThresholdMeters;
      const detectedBySpeed = typeof userSpeed === 'number' && (userSpeed || 0) >= speedThreshold;

      // If either test is true, increase streak; otherwise reset
      if (detectedByDistance || detectedBySpeed) {
        const lastDet = lastMovementDetectionTs.current || 0
        // If detections are spaced too far apart, reset streak
        if (nowTs - lastDet > 3000) {
          movementStreakRef.current = 1
        } else {
          movementStreakRef.current = Math.min(5, movementStreakRef.current + 1)
        }
        lastMovementDetectionTs.current = nowTs

        // Only confirm movement (and set heading) after 2 consecutive detections to reduce spikes
        if (movementStreakRef.current >= 2) {
          isMovingByDistance = detectedByDistance
          isMovingBySpeed = detectedBySpeed
          if (prev && distMeters >= 0.000001) {
            heading = calculateHeading(prev.lat, prev.lng, lat, lng);
            setUserHeading(heading);
          }
          lastMovementTs.current = nowTs;
        }
      } else {
        movementStreakRef.current = 0
        lastMovementDetectionTs.current = null
      }
    }
    // Update prev location after computing distance/heading
    prevUserLocation.current = { lat, lng };

    // User marker: small blue dot with white border, and arrow if heading, size scales with zoom
  const { dotSize: baseDotSize } = getZoomBasedSizes(mapZoom);
  // Clamp dot size to a more visible range (min 10, max 18)
  const dotSize = Math.max(10, Math.min(18, baseDotSize || 12));
  const whiteBorder = 2;
  const blackBorder = 2;
  // Make the arrow same size as the user dot (including borders) per user's request
  const dotTotal = dotSize + 2 * (whiteBorder + blackBorder);
  const arrowSize = dotTotal;
  const arrowStroke = Math.max(1, Math.round(arrowSize / 12));
  // Use the freshly computed heading when available so the arrow shows immediately
  const displayHeading = (heading !== null) ? heading : userHeading
  // Only show arrow when we have a heading and we detected recent significant movement
  // Show for a short window (2s) after movement to avoid flicker from small GPS jumps
  const now = Date.now();
  const showWindowMs = 3000;
  const movedRecently = lastMovementTs.current !== null && (now - (lastMovementTs.current || 0) <= showWindowMs);
  // Do not show arrow while user is interacting with the map
  const showArrow = !mapIsInteractingRef.current && displayHeading !== null && movedRecently;

    // When the arrow is shown we hide the dot (render a transparent placeholder div)
    const userHtml = showArrow ?
      `<div style="width:${dotTotal}px;height:${dotTotal}px;opacity:0;pointer-events:none"></div>` :
      `
      <div style="position:relative;overflow:visible;width:${dotTotal}px;height:${dotTotal}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${dotSize + 2 * (whiteBorder + blackBorder)}px;height:${dotSize + 2 * (whiteBorder + blackBorder)}px;border-radius:50%;background:#000;"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${dotSize + 2 * whiteBorder}px;height:${dotSize + 2 * whiteBorder}px;border-radius:50%;background:#fff;"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:#2563eb;box-shadow:0 1px 4px rgba(0,0,0,0.18);"></div>
      </div>
    `;
    // Use dotTotal as the marker container (arrow is separate overlay)
    const totalSize = dotTotal;
    // Only add the divIcon marker when not showing the arrow. When showing the arrow,
    // we want to remove the divIcon completely so the overlay arrow isn't occluded.
    if (!showArrow) {
      const userLocationIcon = L.divIcon({
        html: userHtml,
        className: 'user-location-marker',
        iconSize: [totalSize, totalSize],
        iconAnchor: [totalSize/2, totalSize/2]
      });

      L.marker([lat, lng], { icon: userLocationIcon }).addTo(mapRef.current);
      // If an overlay exists (from previous movement), remove it so only the dot shows
      if (userArrowOverlayRef.current && userArrowOverlayRef.current.parentNode) {
        try { userArrowOverlayRef.current.parentNode.removeChild(userArrowOverlayRef.current) } catch (e) {}
        userArrowOverlayRef.current = null
      }
    }

    // Also render a separate SVG overlay in the map overlayPane so the arrow is not clipped
    try {
      if (mapRef.current && mapRef.current.getPanes) {
        const panes = mapRef.current.getPanes()
  // Prefer markerPane so the overlay is above marker elements; fall back to overlayPane
  const overlayPane = (panes && (panes.markerPane || panes.overlayPane))
  if (overlayPane) {
          const point = mapRef.current.latLngToLayerPoint([lat, lng])
          // Make the overlay somewhat larger than the dot so the arrow is clearly visible
          const overlaySize = Math.round(Math.max(arrowSize * 1.15, arrowSize + 6))

          if (showArrow) {
            // Create overlay if missing
            if (!userArrowOverlayRef.current) {
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGElement
              svg.setAttribute('width', `${overlaySize}`)
              svg.setAttribute('height', `${overlaySize}`)
              svg.setAttribute('viewBox', '0 0 240 240')
              svg.style.position = 'absolute'
              svg.style.pointerEvents = 'none'
              svg.style.zIndex = '1500'
              overlayPane.appendChild(svg)
              userArrowOverlayRef.current = svg
              // Attach reposition handler so the overlay follows the map when panning/zooming
              try {
                const reposition = () => {
                  if (!mapRef.current || !userArrowOverlayRef.current) return;
                  const p2 = mapRef.current.latLngToLayerPoint([lat, lng]);
                  const s2 = overlaySize;
                  userArrowOverlayRef.current.style.left = `${Math.round(p2.x - s2/2)}px`;
                  userArrowOverlayRef.current.style.top = `${Math.round(p2.y - s2/2)}px`;
                }
                // store on element for later removal
                (userArrowOverlayRef.current as any)._repositionFn = reposition
                mapRef.current.on('move', reposition)
                mapRef.current.on('zoom', reposition)
                mapRef.current.on('resize', reposition)
              } catch (e) {}
            }

            // Update SVG content and position (use smoothed heading)
            const svgEl = userArrowOverlayRef.current as any
            if (svgEl) {
              svgEl.setAttribute('width', `${overlaySize}`)
              svgEl.setAttribute('height', `${overlaySize}`)
              svgEl.setAttribute('viewBox', '0 0 240 240')
              // Center the overlay on the user dot
              svgEl.style.left = `${Math.round(point.x - overlaySize/2)}px`
              svgEl.style.top = `${Math.round(point.y - overlaySize/2)}px`
              // Smooth heading using a small low-pass filter to reduce jitter
              const rawHeading = typeof displayHeading === 'number' ? displayHeading : null
              let useHeading = rawHeading
              if (rawHeading !== null) {
                const prevSm = smoothedHeadingRef.current
                if (prevSm === null) {
                  smoothedHeadingRef.current = rawHeading
                  useHeading = rawHeading
                } else {
                  // Shortest angular difference
                  let delta = ((rawHeading - prevSm + 540) % 360) - 180
                  const alpha = 0.25 // smoothing factor (0..1), lower = smoother
                  const newSm = (prevSm + delta * alpha + 360) % 360
                  smoothedHeadingRef.current = newSm
                  useHeading = newSm
                }
              }
              // Render polygon without inline rotation; rotate the whole SVG element for smoother transforms
              svgEl.innerHTML = `<polygon points="120,10 230,230 120,180 10,230" fill="rgba(37,99,235,0.96)" stroke="#0f172a" stroke-width="${Math.max(1, Math.round(overlaySize/48))}" stroke-linejoin="round" stroke-linecap="round" />`
              if (useHeading !== null) {
                svgEl.style.transformOrigin = '50% 50%'
                svgEl.style.transform = `rotate(${useHeading}deg)`
              }
            }
            // Defensive: remove any leftover divIcon markers that might still exist
            try {
              mapRef.current.eachLayer((layer: any) => {
                try {
                  if (layer.options && layer.options.icon && layer.options.icon.options.className === 'user-location-marker') {
                    mapRef.current.removeLayer(layer)
                  }
                } catch (e) {}
              })
            } catch (e) {}
          } else {
            // Ensure overlay removed when not showing arrow
            if (userArrowOverlayRef.current && userArrowOverlayRef.current.parentNode) {
              try {
                // remove map listeners attached to the overlay
                const fn = (userArrowOverlayRef.current as any)._repositionFn
                if (fn && mapRef.current) {
                  try { mapRef.current.off('move', fn) } catch(e) {}
                  try { mapRef.current.off('zoom', fn) } catch(e) {}
                  try { mapRef.current.off('resize', fn) } catch(e) {}
                }
                userArrowOverlayRef.current.parentNode.removeChild(userArrowOverlayRef.current)
              } catch(e) {}
              userArrowOverlayRef.current = null
            }
          }
        }
      }
    } catch (e) {
      // ignore overlay errors
    }
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

  // Measuring tool functions
  const startMeasuring = () => {
    setIsMeasuring(true)
    setMeasurePoints([])
    setTotalMeasureDistance(0)
    setShowMeasureComplete(false)
    clearMeasureElements()
  }

  const addMeasurePoint = (lat: number, lng: number) => {
    if (!mapRef.current || !L) return

    const newPoints = [...measurePoints, { lat, lng }]
    setMeasurePoints(newPoints)

    // Add marker for this point
    const pointNumber = newPoints.length
    const markerIcon = L.divIcon({
      html: `<div style="
        background: #3b82f6;
        color: white;
        border: 3px solid white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">${pointNumber}</div>`,
      className: 'measure-point-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })

    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(mapRef.current)
    setMeasureMarkers(prev => [...prev, marker])

    // Calculate total distance
    if (newPoints.length >= 2) {
      let totalDistance = 0
      for (let i = 1; i < newPoints.length; i++) {
        totalDistance += calculateDistance(
          newPoints[i - 1].lat,
          newPoints[i - 1].lng,
          newPoints[i].lat,
          newPoints[i].lng
        )
      }
      setTotalMeasureDistance(totalDistance)

      // Draw polyline
      if (measurePolyline && mapRef.current) {
        mapRef.current.removeLayer(measurePolyline)
      }

      const polyline = L.polyline(
        newPoints.map(p => [p.lat, p.lng]),
        {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 5',
          lineCap: 'round',
          lineJoin: 'round'
        }
      ).addTo(mapRef.current)

      setMeasurePolyline(polyline)
    }
  }

  const clearMeasureElements = () => {
    // Remove polyline
    if (measurePolyline && mapRef.current) {
      mapRef.current.removeLayer(measurePolyline)
      setMeasurePolyline(null)
    }

    // Remove markers
    measureMarkers.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker)
      }
    })
    setMeasureMarkers([])
  }

  const completeMeasuring = () => {
    if (measurePoints.length < 2) {
      alert('Lägg till minst 2 punkter för att mäta avstånd')
      return
    }
    setShowMeasureComplete(true)
  }

  const cancelMeasuring = () => {
    setIsMeasuring(false)
    setMeasurePoints([])
    setTotalMeasureDistance(0)
    setShowMeasureComplete(false)
    clearMeasureElements()
  }

  const undoLastMeasurePoint = () => {
    if (measurePoints.length === 0) return

    const newPoints = measurePoints.slice(0, -1)
    setMeasurePoints(newPoints)

    // Remove last marker
    const lastMarker = measureMarkers[measureMarkers.length - 1]
    if (lastMarker && mapRef.current) {
      mapRef.current.removeLayer(lastMarker)
    }
    setMeasureMarkers(prev => prev.slice(0, -1))

    // Recalculate distance and redraw polyline
    if (newPoints.length >= 2) {
      let totalDistance = 0
      for (let i = 1; i < newPoints.length; i++) {
        totalDistance += calculateDistance(
          newPoints[i - 1].lat,
          newPoints[i - 1].lng,
          newPoints[i].lat,
          newPoints[i].lng
        )
      }
      setTotalMeasureDistance(totalDistance)

      // Redraw polyline
      if (measurePolyline && mapRef.current) {
        mapRef.current.removeLayer(measurePolyline)
      }

      const polyline = L.polyline(
        newPoints.map(p => [p.lat, p.lng]),
        {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 5',
          lineCap: 'round',
          lineJoin: 'round'
        }
      ).addTo(mapRef.current)

      setMeasurePolyline(polyline)
    } else {
      // Only one point left, remove polyline
      if (measurePolyline && mapRef.current) {
        mapRef.current.removeLayer(measurePolyline)
        setMeasurePolyline(null)
      }
      setTotalMeasureDistance(0)
    }
  }

  const exportMeasureAsGPX = () => {
    if (measurePoints.length < 2) {
      alert('Minst 2 punkter krävs för att spara GPX')
      return
    }

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Svampkartan - Min Svampkarta" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${measureRouteName}</name>
    <desc>Mätlinje skapad i Svampkartan - Total distans: ${formatDistance(totalMeasureDistance)}</desc>
    <time>${new Date().toISOString()}</time>
    <keywords>svampkartan, mätlinje, vandring</keywords>
  </metadata>
  <trk>
    <name>${measureRouteName}</name>
    <desc>Totalt ${measurePoints.length} punkter, ${formatDistance(totalMeasureDistance)}</desc>
    <trkseg>
${measurePoints.map((p, idx) => `      <trkpt lat="${p.lat}" lon="${p.lng}">
        <name>Punkt ${idx + 1}</name>
        <time>${new Date().toISOString()}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`

    // Create and download file
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `svampkartan_${measureRouteName.replace(/\s/g, '_')}_${Date.now()}.gpx`
    link.click()
    URL.revokeObjectURL(url)

    // Show success message
    alert(`GPX-fil sparad: ${measureRouteName}`)
  }

  const importGPXFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const gpxText = e.target?.result as string
        const parser = new DOMParser()
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml')

        // Extract all trackpoints
        const trkpts = gpxDoc.querySelectorAll('trkpt')
        const points = Array.from(trkpts).map(pt => ({
          lat: parseFloat(pt.getAttribute('lat') || '0'),
          lng: parseFloat(pt.getAttribute('lon') || '0')
        }))

        if (points.length === 0) {
          alert('Inga punkter hittades i GPX-filen')
          return
        }

        // Get route name from GPX
        const nameElement = gpxDoc.querySelector('trk > name')
        const routeName = nameElement?.textContent || 'Importerad rutt'

        // Clear existing measurement and load imported route
        clearMeasureElements()
        setMeasurePoints([])
        setMeasureRouteName(routeName)
        setIsMeasuring(true)

        // Add each point
        points.forEach(point => {
          addMeasurePoint(point.lat, point.lng)
        })

        // Show success message
        alert(`GPX-fil importerad: ${routeName}\n${points.length} punkter, ${formatDistance(totalMeasureDistance)}`)

        // Zoom to fit the route
        if (mapRef.current && L) {
          const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]))
          mapRef.current.fitBounds(bounds, { padding: [50, 50] })
        }
      } catch (error) {
        console.error('Error parsing GPX:', error)
        alert('Kunde inte läsa GPX-filen. Kontrollera att filen är korrekt formaterad.')
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be selected again
    event.target.value = ''
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
    // Prevent car controls during walking navigation
    if (showWalkingDirection) {
      return
    }
    
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
    // Handle measuring mode first
    if (isMeasuring) {
      addMeasurePoint(lat, lng)
      return
    }
    
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
    marker.on('click', () => {
      // Cancel any existing navigation to a mushroom before handling the car click
      clearExistingNavigation()
      // Always zoom to show both user and car when clicking the marker
      if (userLocation && mapRef.current) {
        const bounds = L.latLngBounds([
          [userLocation.lat, userLocation.lng],
          [lat, lng]
        ]);
        mapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          animate: true,
          duration: 1,
          maxZoom: 16
        });
      }
      findCar();
    });
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
      setCurrentCarDistance(null)
      if (carDirectionLine && mapRef.current) {
        mapRef.current.removeLayer(carDirectionLine)
        setCarDirectionLine(null)
      }
    } else {
      // Turn on car direction
      setShowCarDirection(true)
      
      // Zoom to show both user and car position
      if (mapRef.current) {
        if (userLocation) {
          // Calculate bounds to show both positions
          const bounds = L.latLngBounds([
            [userLocation.lat, userLocation.lng],
            [carLocation.lat, carLocation.lng]
          ])
          
          // Fit bounds with padding
          mapRef.current.fitBounds(bounds, {
            padding: [50, 50],
            animate: true,
            duration: 1,
            maxZoom: 16
          })
        } else {
          // If no user location, just zoom to car
          mapRef.current.setView([carLocation.lat, carLocation.lng], 16, {
            animate: true,
            duration: 1
          })
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

    // Create modern gradient line between user and car
    const path = [[userLocation.lat, userLocation.lng], [carLocation.lat, carLocation.lng]];
    const line = L.polyline(path, {
      color: '#ef4444', // fallback
      weight: 7,
      opacity: 1,
      dashArray: '0',
      lineCap: 'round',
      lineJoin: 'round',
      className: 'modern-nav-line-car'
    }).addTo(mapRef.current);
    // Add SVG gradient effect
    setTimeout(() => {
      const svg = mapRef.current.getPane('overlayPane').querySelector('svg');
      if (svg && !svg.querySelector('#car-gradient')) {
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'car-gradient');
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '100%');
        grad.setAttribute('y2', '0%');
        grad.innerHTML = `
          <stop offset="0%" stop-color="#f87171"/>
          <stop offset="100%" stop-color="#991b1b"/>
        `;
        svg.insertBefore(grad, svg.firstChild);
      }
      const pathEl = svg?.querySelector('.modern-nav-line-car');
      if (pathEl) {
        pathEl.setAttribute('stroke', 'url(#car-gradient)');
        pathEl.setAttribute('filter', 'drop-shadow(0px 2px 6px rgba(239,68,68,0.18))');
      }
    }, 0);

    // Calculate and store distance
    const distance = mapRef.current.distance(
      [userLocation.lat, userLocation.lng], 
      [carLocation.lat, carLocation.lng]
    ) / 1000 // Convert to kilometers
    setCurrentCarDistance(distance)
    console.log(`Distance to car: ${Math.round(distance * 1000)}m`)

    // Add a tooltip to the line with the distance
    if (typeof formatDistance === 'function') {
      line.bindTooltip(`${formatDistance(distance)}`, {
        permanent: true,
        direction: 'center',
        className: 'car-distance-tooltip',
        offset: [0, -10],
        opacity: 0.95
      }).openTooltip();
    }
    setCarDirectionLine(line)
  }

  // Expose findCar function globally for popup access
  useEffect(() => {
    (window as any).findCarFromPopup = findCar
    return () => {
      delete (window as any).findCarFromPopup
    }
  }, [carLocation, showCarDirection, carDirectionLine])

  const updateWalkingDirectionLine = (shouldZoom = false) => {
    if (!navigationTarget || !userLocation || !mapRef.current || !L || !showWalkingDirection) {
      return
    }

    // Remove existing line
    if (walkingDirectionLine) {
      mapRef.current.removeLayer(walkingDirectionLine)
    }

    // Create modern gradient line between user and mushroom
    const path = [[userLocation.lat, userLocation.lng], [navigationTarget.lat, navigationTarget.lng]];
    const line = L.polyline(path, {
      color: '#22c55e', // fallback
      weight: 7,
      opacity: 1,
      dashArray: '0',
      lineCap: 'round',
      lineJoin: 'round',
      className: 'modern-nav-line-walk'
    }).addTo(mapRef.current);
    // Add SVG gradient effect
    setTimeout(() => {
      const svg = mapRef.current.getPane('overlayPane').querySelector('svg');
      if (svg && !svg.querySelector('#walk-gradient')) {
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'walk-gradient');
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '100%');
        grad.setAttribute('y2', '0%');
        grad.innerHTML = `
          <stop offset="0%" stop-color="#6ee7b7"/>
          <stop offset="100%" stop-color="#059669"/>
        `;
        svg.insertBefore(grad, svg.firstChild);
      }
      const pathEl = svg?.querySelector('.modern-nav-line-walk');
      if (pathEl) {
        pathEl.setAttribute('stroke', 'url(#walk-gradient)');
        pathEl.setAttribute('filter', 'drop-shadow(0px 2px 6px rgba(16,185,129,0.18))');
      }
    }, 0);

    // Calculate and update current distance
    const distance = calculateDistance(
      userLocation.lat, 
      userLocation.lng, 
      navigationTarget.lat, 
      navigationTarget.lng
    )
    setCurrentNavigationDistance(distance)

    // Add a tooltip to the line with the distance
    if (typeof formatDistance === 'function') {
      line.bindTooltip(`${formatDistance(distance)}`, {
        permanent: true,
        direction: 'center',
        className: 'walk-distance-tooltip',
        offset: [0, -10],
        opacity: 0.95
      }).openTooltip();
    }
    setWalkingDirectionLine(line)

    // Only zoom on initial setup, not on location updates
    if (shouldZoom) {
      // Zoom to show both user and target position
      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [navigationTarget.lat, navigationTarget.lng]
      ])
      
      // Fit bounds with larger padding for better context
      if (!isUserPanning.current) {
        mapRef.current.fitBounds(bounds, {
          padding: [30, 30],
          animate: true,
          duration: 1,
          maxZoom: 16
        })
      }
    }

  }

  const hideWalkingDirection = () => {
    if (walkingDirectionLine && mapRef.current) {
      mapRef.current.removeLayer(walkingDirectionLine)
    }
    setWalkingDirectionLine(null)
    setShowWalkingDirection(false)
    setNavigationTarget(null)
    setCurrentNavigationDistance(null)
    // Force map redraw to ensure all markers reappear immediately
    if (mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.setView(mapRef.current.getCenter());
    }
  }

  // Clear any existing navigation state
  const clearExistingNavigation = () => {
    // Clear walking navigation
    if (showWalkingDirection) {
      hideWalkingDirection()
    } else {
      // Ensure any existing walking line is removed
      if (walkingDirectionLine && mapRef.current) {
        try { mapRef.current.removeLayer(walkingDirectionLine) } catch (e) {}
        setWalkingDirectionLine(null)
      }
    }

    // Clear car navigation
    if (showCarDirection) {
      setShowCarDirection(false)
    }
    if (carDirectionLine && mapRef.current) {
      try { mapRef.current.removeLayer(carDirectionLine) } catch (e) {}
      setCarDirectionLine(null)
    }

    // Remove any navigation polylines left on the map (className starting with modern-nav-line)
    try {
      if (mapRef.current && mapRef.current.eachLayer) {
        mapRef.current.eachLayer((layer: any) => {
          try {
            const cls = layer.options && layer.options.className
            if (cls && typeof cls === 'string' && cls.indexOf('modern-nav-line') === 0) {
              mapRef.current.removeLayer(layer)
            }
          } catch (e) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }

    // Remove overlay arrow if present
    if (userArrowOverlayRef.current && userArrowOverlayRef.current.parentNode) {
      try { userArrowOverlayRef.current.parentNode.removeChild(userArrowOverlayRef.current) } catch (e) {}
      userArrowOverlayRef.current = null
    }

    // Clear any distances and dialogs
    setCurrentNavigationDistance(null)
    setCurrentCarDistance(null)
    setNavigationTarget(null)
    setShowNavigationDialog(false)
    setShowMapsConfirmation(false)
  }

  // Update car direction line when user location changes
  useEffect(() => {
    if (showCarDirection && userLocation && carLocation) {
      updateCarDirectionLine()
    }
  }, [userLocation, showCarDirection, carLocation])

  // Update walking direction line when user location changes (throttled)
  useEffect(() => {
    if (showWalkingDirection && userLocation && navigationTarget) {
      // Throttle updates to avoid lag during zoom
      const throttleTimeout = setTimeout(() => {
        updateWalkingDirectionLine(true) // Always zoom to fit both positions
      }, 200) // 200ms throttle
      
      return () => clearTimeout(throttleTimeout)
    }
  }, [userLocation, showWalkingDirection, navigationTarget])

  const removeCar = () => {
    // Denna funktion får ENDAST anropas från "ta bort bil"-flödet!
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
    setCurrentCarDistance(null)
    setShowCarControls(false)
    localStorage.removeItem('svampkartan-car-location')
  }

  const closeCarControls = () => {
    setShowCarControls(false)
    if (showCarDirection) {
      setShowCarDirection(false)
      setCurrentCarDistance(null)
      if (carDirectionLine && mapRef.current) {
        mapRef.current.removeLayer(carDirectionLine)
        setCarDirectionLine(null)
      }
    }
  }

  // Switch between map types
  const changeMapType = (newMapType: 'mml-topo' | 'mml-satellite' | 'opentopo' | 'lantmateriet' | 'lantmateriet-satellite') => {
    if (!mapRef.current) return
    
    setCurrentMapType(newMapType)
    
    // Save selected map type to localStorage
    try {
      localStorage.setItem('svampkartan-map-type', newMapType)
    } catch (error) {
      console.log('Could not save map type preference:', error)
    }
    
    // Remove current layer
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current?.removeLayer(layer)
      }
    })
    
    // Add new layer based on selection
    let newLayer
    switch (newMapType) {
      case 'opentopo':
        newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
          maxZoom: 17,
          minZoom: 5
        })
        break
      case 'mml-satellite':
        newLayer = L.tileLayer(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key=85f184f5-f223-443e-b0f6-e6b1aa5f0c14`, {
          attribution: 'Map data: &copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
          maxZoom: 18,
          minZoom: 5
        })
        break
      case 'mml-topo':
      default:
        newLayer = L.tileLayer(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=85f184f5-f223-443e-b0f6-e6b1aa5f0c14`, {
          attribution: 'Map data: &copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
          maxZoom: 18,
          minZoom: 5
        })
        break
      case 'lantmateriet':
        // Use Lantmäteriet WMTS service from minkarta
        newLayer = L.tileLayer('https://minkarta.lantmateriet.se/map/topowebbcache/?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix={z}&TileCol={x}&TileRow={y}', {
          attribution: 'Map data: &copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>',
          maxZoom: 18,
          minZoom: 6
        })
        break
      case 'lantmateriet-satellite':
        // Lantmäteriet Orthophoto via WMS
        newLayer = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/ortofoto/', {
          layers: 'Ortofoto_0.5',
          format: 'image/jpeg',
          transparent: false,
          attribution: 'Aerial imagery: &copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>',
          maxZoom: 18,
          minZoom: 6
        })
        break
    }
    
    newLayer.addTo(mapRef.current)
  }

  // Get category color scheme
  const getCategoryColors = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId) || categories[0]
    const colorMap = {
      green: { primary: 'rgba(16, 185, 129, 0.85)', secondary: 'rgba(236, 253, 245, 0.85)', accent: 'rgba(16, 185, 129, 0.15)' },
      red: { primary: 'rgba(239, 68, 68, 0.85)', secondary: 'rgba(254, 242, 242, 0.85)', accent: 'rgba(239, 68, 68, 0.15)' },
      blue: { primary: 'rgba(59, 130, 246, 0.85)', secondary: 'rgba(239, 246, 255, 0.85)', accent: 'rgba(59, 130, 246, 0.15)' },
      gray: { primary: 'rgba(107, 114, 128, 0.85)', secondary: 'rgba(249, 250, 251, 0.85)', accent: 'rgba(107, 114, 128, 0.15)' },
      purple: { primary: 'rgba(147, 51, 234, 0.85)', secondary: 'rgba(250, 245, 255, 0.85)', accent: 'rgba(147, 51, 234, 0.15)' },
      brown: { primary: 'rgba(120, 53, 15, 0.85)', secondary: 'rgba(252, 248, 227, 0.85)', accent: 'rgba(120, 53, 15, 0.15)' },
      orange: { primary: 'rgba(249, 115, 22, 0.85)', secondary: 'rgba(255, 247, 237, 0.85)', accent: 'rgba(249, 115, 22, 0.15)' }
    }
    return colorMap[category.color as keyof typeof colorMap] || colorMap.green
  }

  // Auto-request location when map loads (background, after showing latest find)
  useEffect(() => {
    if (mapRef.current && L) {
      // Longer delay to let latest find navigation complete first
      setTimeout(() => {
        requestLocation()
      }, 2500) // Give time for latest find navigation to finish
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
          // Start with view showing both Finland and Sweden
          const map = L.map(mapContainerRef.current, {
            center: [62.0, 17.0], // Center between Finland and Sweden
            zoom: 5, // Lower zoom to show both countries
            zoomControl: true,
            zoomAnimation: true,
            zoomAnimationThreshold: 4,
            fadeAnimation: true,
            markerZoomAnimation: true,
            zoomSnap: 0.25, // Allow quarter-step zooms for smoother experience
            zoomDelta: 0.5, // Smaller zoom steps
            wheelPxPerZoomLevel: 120 // Smoother mouse wheel zoom
          })
          // Track map interaction state to avoid arrow activation during zoom/pan
          try {
            map.on('zoomstart', () => { mapIsInteractingRef.current = true; mapLastInteractionTs.current = Date.now(); })
            map.on('movestart', () => { mapIsInteractingRef.current = true; mapLastInteractionTs.current = Date.now(); })
            map.on('zoomend', () => { mapIsInteractingRef.current = false; mapLastInteractionTs.current = Date.now(); })
            map.on('moveend', () => { mapIsInteractingRef.current = false; mapLastInteractionTs.current = Date.now(); })
          } catch (e) {
            // ignore
          }

          // Add double-tap-and-hold zoom functionality for mobile
          let lastTapTime = 0
          let doubleTapTimer: NodeJS.Timeout | null = null
          let isDoubleTapHolding = false
          let touchStartY: number | null = null
          let touchStartZoom: number | null = null

          map.getContainer().addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
              const currentTime = new Date().getTime()
              const tapGap = currentTime - lastTapTime
              
              if (tapGap < 300 && tapGap > 0) {
                // Quick double tap: zoom in one level
                if (!isDoubleTapHolding) {
                  // Zoom in by 2 levels and center on tap location
                  const clientX = e.touches[0].clientX;
                  const clientY = e.touches[0].clientY;
                  const containerPoint = map.mouseEventToContainerPoint({
                    clientX,
                    clientY,
                    target: e.target,
                    type: 'touchstart',
                    // ...other properties if needed
                  });
                  const latlng = map.containerPointToLatLng(containerPoint);
                  map.setView(latlng, map.getZoom() + 1.5, { animate: true });
                  e.preventDefault();
                  lastTapTime = 0;
                  if (doubleTapTimer) clearTimeout(doubleTapTimer);
                  return;
                }
                // Double tap detected - start zoom mode (hold)
                isDoubleTapHolding = true
                touchStartY = e.touches[0].clientY
                touchStartZoom = map.getZoom()
                e.preventDefault() // Only prevent for double tap
                if (doubleTapTimer) clearTimeout(doubleTapTimer)
              } else {
                // First tap or too much time passed - don't prevent default for single taps
                lastTapTime = currentTime
                isDoubleTapHolding = false
                doubleTapTimer = setTimeout(() => {
                  lastTapTime = 0
                }, 300)
              }
            }
          })

          map.getContainer().addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 1 && isDoubleTapHolding && touchStartY !== null && touchStartZoom !== null) {
              e.preventDefault()
              
              const currentY = e.touches[0].clientY
              const deltaY = touchStartY - currentY
              
              // Calculate zoom level based on vertical movement with smoother sensitivity
              const zoomDelta = deltaY / 150 // Reduced sensitivity for smoother control
              const newZoom = Math.max(5, Math.min(17, touchStartZoom + zoomDelta))
              
              // Use smooth animation for zoom changes
              map.setZoom(newZoom, { 
                animate: true,
                duration: 0.1 // Very fast animation for responsiveness
              })
            }
          })

          map.getContainer().addEventListener('touchend', () => {
            isDoubleTapHolding = false
            touchStartY = null
            touchStartZoom = null
          })

          // Primary topographic layer with contours and forest types
          const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            maxZoom: 17,
            minZoom: 5
          })
          
          // Alternative: Lantmäteriet Official Topographic Maps (requires OAuth2 API key)
          const LANTMATERIET_API_KEY = 'eyJ4NXQiOiJPVEk1TjJRMVltWmlOekkxT0RjMVlUVTJNREZsT0RVNU9EUTRPVE15WVdRMFkyVXpOamN5T1EiLCJraWQiOiJNVE5tTkRNeVpHSmxOakJrTXpoallqTm1ZMlV5Tm1Ka1lUQTROR0ZoTmpNMU1ETmpabVJoTjJGbVkySTJOVGc0TmpKbVl6ZGxZamhqWkRFeFpURTVOd19SUzI1NiIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJiXzE5NDgxNzI5IiwiYXV0IjoiQVBQTElDQVRJT04iLCJhdWQiOiIxTlcwSHd4V3lmdUdJYmVXSjRTc3lKVVV0VThhIiwibmJmIjoxNzU4MDQ5NjMxLCJhenAiOiIxTlcwSHd4V3lmdUdJYmVXSjRTc3lKVVV0VThhIiwic2NvcGUiOiJkZWZhdWx0IiwiaXNzIjoiaHR0cHM6XC9cL2FwaW1hbmFnZXIubGFudG1hdGVyaWV0LnNlIiwiZXhwIjoxNzU4MDUzMjMxLCJpYXQiOjE3NTgwNDk2MzEsImp0aSI6IjhjZjY2ZjU0LWExMjQtNDZhNi1iYTkwLTVhOTM0OTU0MjZmNSJ9.ND37WdkoMNqWLoPIWe01TCQkFASAg2QFI-HA3cGZ3u00GJZ_VsS1PHs267xTZqQD1vN4rI9Dk6nm-vNdrtjR4KJcAnRQyv0tdZOuOpIKF-W7vx9_7ZrI8TpNQ2FaS9JLg5Ck6gxwEy8hNNu7V5GLh-maAR4O7vBH2qnhBzkZEWaHH4B88hohSm0SqxEZj8O62uX_2dmdQ9QbUj0ZY6RcxNARsnlEr806EoiOeeCo7ZrkjBYi_0WuhizNBC2MGpoySX4KfQy2EAgTLr2i59YkkXUD4ubatV5Up_3cKCEVNTJ50pnulzQuE69tuABpU5gslHBWzCO8ZWsQmpNlt1Z0Wg'
          
          // Create custom tile layer for Lantmäteriet with OAuth2 authentication
          const LantmateriTileLayer = L.TileLayer.extend({
            createTile: function(coords: any, done: any) {
              const tile = document.createElement('img')
              const url = this.getTileUrl(coords)
              
              fetch(url, {
                headers: {
                  'Authorization': `Bearer ${LANTMATERIET_API_KEY}`
                }
              })
              .then(response => response.blob())
              .then(blob => {
                tile.src = URL.createObjectURL(blob)
                done(null, tile)
              })
              .catch(err => {
                console.error('Lantmäteriet tile loading error:', err)
                done(err, tile)
              })
              
              return tile
            }
          })
          
          const lantmateriLayer = new LantmateriTileLayer(`https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/1.0.0/topowebb/default/3857/{z}/{y}/{x}.png`, {
            attribution: 'Map data: &copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a> under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
            maxZoom: 18,
            minZoom: 6
          })
          
          // Alternative: ESRI World Topo with excellent contours
          const esriTopoLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
            maxZoom: 19,
            minZoom: 5
          })
          
          // Fallback: Swedish Topo without authentication (OpenStreetMap based)
          const swedenTopoLayer = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>, Waymarked Trails',
            maxZoom: 18,
            minZoom: 5
          })
          
          // Finnish National Land Survey (MML) - Excellent for Nordic mushroom hunting
          const MML_API_KEY = '85f184f5-f223-443e-b0f6-e6b1aa5f0c14'
          
          // MML Topographic map (perfect for mushroom hunting with forest details)
          const mmlTopoLayer = L.tileLayer(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${MML_API_KEY}`, {
            attribution: 'Map data: &copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
            maxZoom: 18,
            minZoom: 5
          })
          
          // MML Background map (cleaner view)
          const mmlBackgroundLayer = L.tileLayer(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/taustakartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${MML_API_KEY}`, {
            attribution: 'Map data: &copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
            maxZoom: 18,
            minZoom: 5
          })
          
          // MML Ortophoto (satellite imagery)
          const mmlOrthoLayer = L.tileLayer(`https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key=${MML_API_KEY}`, {
            attribution: 'Map data: &copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>',
            maxZoom: 18,
            minZoom: 5
          })
          
          // Add the user's preferred map type as default (loaded from localStorage)
          let initialLayer
          switch (currentMapType) {
            case 'opentopo':
              initialLayer = topoLayer
              break
            case 'mml-satellite':
              initialLayer = mmlOrthoLayer
              break
            case 'mml-topo':
              initialLayer = mmlTopoLayer
              break
            case 'lantmateriet':
              initialLayer = L.tileLayer('https://minkarta.lantmateriet.se/map/topowebbcache/?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix={z}&TileCol={x}&TileRow={y}', {
                attribution: 'Map data: &copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>',
                maxZoom: 18,
                minZoom: 6
              })
              break
            case 'lantmateriet-satellite':
              initialLayer = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/ortofoto/', {
                layers: 'Ortofoto_0.5',
                format: 'image/jpeg',
                transparent: false,
                attribution: 'Aerial imagery: &copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a>',
                maxZoom: 18,
                minZoom: 6
              })
              break
            default:
              initialLayer = topoLayer
          }
          
          initialLayer.addTo(map)
          
          // Using OpenTopoMap as the default map
          const markersLayer = L.layerGroup().addTo(map)
          markersLayerRef.current = markersLayer

          mapRef.current = map
          setIsMapLoaded(true)
          
          // Navigate to latest find if available
          if (markers.length > 0) {
            // Sort markers by creation date (most recent first)
            const sortedMarkers = [...markers].sort((a, b) => {
              const timeA = new Date(a.date).getTime()
              const timeB = new Date(b.date).getTime()
              return timeB - timeA
            })
            
            const latestFind = sortedMarkers[0]
            console.log('Navigating to latest find:', latestFind.name)
            
            // Center map on latest find with appropriate zoom
            map.setView([latestFind.lat, latestFind.lng], 14, {
              animate: true,
              duration: 1.5
            })
          }
          
          // Force map to render properly
          setTimeout(() => {
            map.invalidateSize()
          }, 100)
          
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
  }, [L, currentMapType])

  // Add markers to map
  // Create stable, primitive keys for complex state so the dependency array length/order stays constant
  const visibleCategoryIdsKey = visibleCategoryIds.join('|')
  const selectedMarkerId = selectedMarker ? selectedMarker.id : null
  const navigationTargetId = navigationTarget ? navigationTarget.id : null

  useEffect(() => {
    if (!markersLayerRef.current || !L) return

    markersLayerRef.current.clearLayers()

    // Filtrera markers som ska visas på kartan baserat på valda kategorier
    // Men se till att den marker som användaren har valt från listan alltid inkluderas
    const filteredMarkers = markers.filter(marker => visibleCategoryIds.includes(marker.category) || (selectedMarkerId !== null && marker.id === selectedMarkerId))

    // Clustering configuration
    const CLUSTER_MIN_COUNT = 50 // Start clustering when >= 50 markers visible
    const DISABLE_CLUSTER_ZOOM = 15 // Disable clustering when zoomed in beyond this level
    const shouldCluster = (filteredMarkers.length >= CLUSTER_MIN_COUNT || mapZoom <= 10) && mapZoom < DISABLE_CLUSTER_ZOOM

    if (!shouldCluster) {
      // Render individual markers when count is low or zoomed in
      filteredMarkers.forEach(marker => {
        // Hide other mushrooms during walking navigation, only show target
        if (showWalkingDirection && navigationTarget && marker.id !== navigationTarget.id) {
          return // Skip rendering this marker
        }
        
        const sizes = getZoomBasedSizes(mapZoom)
        const categoryColors = getCategoryColors(marker.category || 'edible')
        
        // Modern SVG mushroom pin marker
        const green = '#10b981';
        const mushroomIcon = L.divIcon({
          html: `
            <style>
              .mushroom-marker-modern {
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                transition: transform 0.2s cubic-bezier(.4,0,.2,1);
              }
              .mushroom-marker-modern:hover {
                transform: scale(1.08) translateY(-6px);
                filter: drop-shadow(0 8px 24px rgba(0,0,0,0.18));
              }
            </style>
              <div class="mushroom-marker-modern" style="height:44px;width:18px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
                <div style="
                  background: rgba(0,0,0,0.82);
                  border: none;
                  border-radius: 5px;
                  padding: 1.5px 10px 4px 10px;
                  font-size: 11px;
                  font-weight: 400;
                  color: #fff;
                  box-shadow: 0 4px 16px rgba(16,185,129,0.10), 0 1.5px 6px rgba(0,0,0,0.10);
                  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                  text-align: center;
                  letter-spacing: -0.2px;
                  text-shadow: none;
                  max-width: 120px;
                  overflow: visible;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  margin-bottom: 2px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  gap: 2px;
                  filter: drop-shadow(0 2px 6px rgba(16,185,129,0.08));
                ">
                  <span style="display:inline-block;vertical-align:middle;">
                    ${(categories.find(cat => cat.id === marker.category)?.emoji || '❓')} ${marker.name}
                  </span>
                  <span style="display:flex;flex-direction:row;align-items:center;gap:2px;margin-top:2px;">
                    ${Array.from({length: 5}, (_, i) => `
                      <span style="
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: ${i < (marker.abundance || 3) 
                          ? green 
                          : '#e5e7eb'};
                        box-shadow: ${i < (marker.abundance || 3) 
                          ? '0 1px 2px rgba(16, 185, 129, 0.3), inset 0 1px 1px rgba(255,255,255,0.2)' 
                          : '0 1px 1px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.7)'};
                        border: 1px solid #fff;
                        display: inline-block;
                      "></span>
                    `).join('')}
                  </span>
                </div>
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top: 0;">
                <polygon points="9,12 0,0 18,0" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/>
              </svg>
            </div>
          `,
          className: 'mushroom-icon-modern',
          iconSize: [18, 44],
          iconAnchor: [9, 44]
        })
        
        const leafletMarker = L.marker([marker.lat, marker.lng], { icon: mushroomIcon })
        
        // Add click handler to open marker details with navigation options
        leafletMarker.on('click', () => {
          // Clicking the marker on the map should cancel any existing navigation
          // (walking or car) and open the details modal for the clicked marker.
          clearExistingNavigation()
          setSelectedMarker(marker)
          setShowMarkerDetails(true)
        })
        
        markersLayerRef.current?.addLayer(leafletMarker)
      })
    } else {
      // Clustering mode: group nearby markers
      const gridSize = Math.max(40, Math.round(60 * (11 / Math.max(1, mapZoom)))) // Grid size increases when zoomed out
      const clusters: Record<string, { 
        count: number; 
        latSum: number; 
        lngSum: number; 
        markers: MushroomMarker[] 
      }> = {}

      // Group markers into grid cells
      filteredMarkers.forEach(marker => {
        if (showWalkingDirection && navigationTarget && marker.id !== navigationTarget.id) {
          return // Skip during navigation
        }

        try {
          const point = mapRef.current.latLngToLayerPoint([marker.lat, marker.lng])
          const gridKey = `${Math.floor(point.x / gridSize)}:${Math.floor(point.y / gridSize)}`
          
          if (!clusters[gridKey]) {
            clusters[gridKey] = { count: 0, latSum: 0, lngSum: 0, markers: [] }
          }
          
          clusters[gridKey].count++
          clusters[gridKey].latSum += marker.lat
          clusters[gridKey].lngSum += marker.lng
          clusters[gridKey].markers.push(marker)
        } catch (e) {
          // Fallback: render individual marker if projection fails
          const fallbackIcon = L.divIcon({
            html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">🍄</div>`,
            className: 'mushroom-fallback',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
          const fallbackMarker = L.marker([marker.lat, marker.lng], { icon: fallbackIcon })
          fallbackMarker.on('click', () => {
            clearExistingNavigation()
            setSelectedMarker(marker)
            setShowMarkerDetails(true)
          })
          markersLayerRef.current?.addLayer(fallbackMarker)
        }
      })

      // Render clusters or individual markers
      Object.values(clusters).forEach(cluster => {
        if (cluster.count === 1) {
          // Single marker: render with full styling like non-clustered mode
          const marker = cluster.markers[0]
          const green = '#10b981'
          const singleIcon = L.divIcon({
            html: `
              <style>
                .mushroom-marker-modern {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  cursor: pointer;
                  transition: transform 0.2s cubic-bezier(.4,0,.2,1);
                }
                .mushroom-marker-modern:hover {
                  transform: scale(1.08) translateY(-6px);
                  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.18));
                }
              </style>
                <div class="mushroom-marker-modern" style="height:44px;width:18px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
                  <div style="
                    background: rgba(0,0,0,0.82);
                    border: none;
                    border-radius: 5px;
                    padding: 1.5px 10px 4px 10px;
                    font-size: 11px;
                    font-weight: 400;
                    color: #fff;
                    box-shadow: 0 4px 16px rgba(16,185,129,0.10), 0 1.5px 6px rgba(0,0,0,0.10);
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                    text-align: center;
                    letter-spacing: -0.2px;
                    text-shadow: none;
                    max-width: 120px;
                    overflow: visible;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    filter: drop-shadow(0 2px 6px rgba(16,185,129,0.08));
                  ">
                    <span style="display:inline-block;vertical-align:middle;">
                      ${(categories.find(cat => cat.id === marker.category)?.emoji || '❓')} ${marker.name}
                    </span>
                    <span style="display:flex;flex-direction:row;align-items:center;gap:2px;margin-top:2px;">
                      ${Array.from({length: 5}, (_, i) => `
                        <span style="
                          width: 6px;
                          height: 6px;
                          border-radius: 50%;
                          background: ${i < (marker.abundance || 3) 
                            ? green 
                            : '#e5e7eb'};
                          box-shadow: ${i < (marker.abundance || 3) 
                            ? '0 1px 2px rgba(16, 185, 129, 0.3), inset 0 1px 1px rgba(255,255,255,0.2)' 
                            : '0 1px 1px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.7)'};
                          border: 1px solid #fff;
                          display: inline-block;
                        "></span>
                      `).join('')}
                    </span>
                  </div>
                <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top: 0;">
                  <polygon points="9,12 0,0 18,0" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/>
                </svg>
              </div>
            `,
            className: 'mushroom-icon-modern',
            iconSize: [18, 44],
            iconAnchor: [9, 44]
          })
          const singleMarker = L.marker([marker.lat, marker.lng], { icon: singleIcon })
          singleMarker.on('click', () => {
            clearExistingNavigation()
            setSelectedMarker(marker)
            setShowMarkerDetails(true)
          })
          markersLayerRef.current?.addLayer(singleMarker)
        } else {
          // Multiple markers: render as cluster
          const avgLat = cluster.latSum / cluster.count
          const avgLng = cluster.lngSum / cluster.count
          const count = cluster.count

          const clusterIcon = L.divIcon({
            html: `
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%);
                color: #fff;
                font-weight: 700;
                font-size: 14px;
                border: 3px solid rgba(255, 255, 255, 0.9);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
                cursor: pointer;
                transition: transform 0.2s ease;
              " class="cluster-marker">
                ${count}
              </div>
              <style>
                .cluster-marker:hover {
                  transform: scale(1.1);
                }
              </style>
            `,
            className: 'mushroom-cluster',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          })

          const clusterMarker = L.marker([avgLat, avgLng], { icon: clusterIcon })
          clusterMarker.on('click', () => {
            // Zoom to show all markers in this cluster
            if (cluster.markers.length === 1) {
              mapRef.current.setView([avgLat, avgLng], Math.min(18, mapZoom + 3), { animate: true })
            } else {
              const bounds = L.latLngBounds(cluster.markers.map(m => [m.lat, m.lng]))
              mapRef.current.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 17 })
            }
          })
          markersLayerRef.current?.addLayer(clusterMarker)
        }
      })
    }
  // Depend on stable primitives (strings/ids/lengths) rather than raw objects/arrays which may change shape
  }, [markers, L, mapZoom, visibleCategoryIdsKey, showWalkingDirection, navigationTargetId, categories.length, selectedMarkerId])

  // Handle map clicks for adding markers
  useEffect(() => {
    if (!mapRef.current || !L) return

    const handleMapClick = (e: any) => {
      // Handle measuring mode first
      if (isMeasuring) {
        addMeasurePoint(e.latlng.lat, e.latlng.lng)
        return
      }
      
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

    if (isAddingMarker || isParkingMode || isMeasuring) {
      mapRef.current.on('click', handleMapClick)
      mapRef.current.getContainer().style.cursor = (isParkingMode || isMeasuring) ? 'crosshair' : 'crosshair'
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
  }, [isAddingMarker, isParkingMode, isMeasuring, L, measurePoints, measurePolyline, measureMarkers])

  // Handle long press for adding markers (2 seconds)
  useEffect(() => {
    if (!mapRef.current || !L) return

  let longPressTimer: NodeJS.Timeout
  let isLongPressing = false
  let startPosition: { x: number, y: number } | null = null
  let startLatLng: { lat: number, lng: number } | null = null

    const handlePointerDown = (e: TouchEvent | MouseEvent) => {
      // Don't trigger long press if we're already in adding mode or parking mode
      if (isAddingMarker || isParkingMode) return

      // Only handle single touch/click
      if (e instanceof TouchEvent && e.touches.length > 1) return

      console.log('Long press: pointer down detected') // Debug log

      isLongPressing = false
      
      const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
      const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY
      
      startPosition = { x: clientX, y: clientY }
      
      // Convert screen coordinates to map coordinates
      const point = mapRef.current!.containerPointToLatLng([clientX, clientY])
      startLatLng = { lat: point.lat, lng: point.lng }
      
      console.log('Long press: starting timer for coordinates:', startLatLng) // Debug log
      
      longPressTimer = setTimeout(() => {
        console.log('Long press: timer triggered!') // Debug log
        isLongPressing = true
        // Trigger haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
        // Set pending marker at long press location and open add dialog
        if (startLatLng) {
          setPendingMarker({ lat: startLatLng.lat, lng: startLatLng.lng })
          setIsAddingMarker(true)
        }
      }, 1000) // 1000 milliseconds
    }

    const handlePointerUp = (e: TouchEvent | MouseEvent) => {
      console.log('Long press: pointer up') // Debug log
      if (longPressTimer) {
        clearTimeout(longPressTimer)
      }
      
      // Reset if it was a long press
      if (isLongPressing) {
        isLongPressing = false
      }
    }

    const handlePointerMove = (e: TouchEvent | MouseEvent) => {
      // Cancel long press if user moves too much (prevents accidental triggers while panning)
      if (startPosition && longPressTimer) {
        const clientX = e instanceof TouchEvent ? e.touches[0]?.clientX : e.clientX
        const clientY = e instanceof TouchEvent ? e.touches[0]?.clientY : e.clientY
        
        if (clientX && clientY) {
          const moveDistance = Math.sqrt(
            Math.pow(clientX - startPosition.x, 2) + 
            Math.pow(clientY - startPosition.y, 2)
          )
          
          // Cancel if moved more than 25 pixels (more forgiving on mobile)
          if (moveDistance > 25) {
            console.log('Long press: cancelled due to movement') // Debug log
            clearTimeout(longPressTimer)
            isLongPressing = false
          }
        }
      }
    }

    // Use DOM events directly instead of Leaflet events to avoid conflicts
    const mapContainer = mapRef.current.getContainer()
    
  mapContainer.addEventListener('mousedown', handlePointerDown as EventListener, { passive: false })
  mapContainer.addEventListener('touchstart', handlePointerDown as EventListener, { passive: false })
  mapContainer.addEventListener('mouseup', handlePointerUp as EventListener, { passive: false })
  mapContainer.addEventListener('touchend', handlePointerUp as EventListener, { passive: false })
  mapContainer.addEventListener('mousemove', handlePointerMove as EventListener, { passive: false })
  mapContainer.addEventListener('touchmove', handlePointerMove as EventListener, { passive: false })

    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
      }
      if (mapRef.current) {
        const mapContainer = mapRef.current.getContainer()
        mapContainer.removeEventListener('mousedown', handlePointerDown as EventListener)
        mapContainer.removeEventListener('touchstart', handlePointerDown as EventListener)
        mapContainer.removeEventListener('mouseup', handlePointerUp as EventListener)
        mapContainer.removeEventListener('touchend', handlePointerUp as EventListener)
        mapContainer.removeEventListener('mousemove', handlePointerMove as EventListener)
        mapContainer.removeEventListener('touchmove', handlePointerMove as EventListener)
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
  
  // Backup/Restore state
  const [showBackupDialog, setShowBackupDialog] = useState(false)

  const addMarker = () => {
    if (!pendingMarker || !newMarkerForm.name.trim()) return
    
    const newMarker: MushroomMarker = {
      id: Date.now(),
      name: newMarkerForm.name,
      lat: pendingMarker.lat,
      lng: pendingMarker.lng,
      date: new Date().toISOString().split('T')[0],
      notes: newMarkerForm.notes,
      abundance: newMarkerForm.abundance,
      category: newMarkerForm.category
    }
    
    setMarkers([...markers, newMarker])
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '', abundance: 3, category: 'unknown' })
    
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
        // Use a function to get the latest state
        setUserLocation((currentUserLocation) => {
          if (currentUserLocation) {
            setPendingMarker({ lat: currentUserLocation.lat, lng: currentUserLocation.lng })
          } else {
            alert('Kunde inte hämta din position. Klicka på kartan istället.')
            setIsAddingMarker(true)
          }
          return currentUserLocation // Don't change the state
        })
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

  // Backup and Restore Functions
  const exportFinds = async () => {
    console.log('exportFinds called')
    const customCategories = categories.filter(cat => !DEFAULT_CATEGORIES.find(def => def.id === cat.id))
    const removedDefaults = DEFAULT_CATEGORIES.filter(def => !categories.find(cat => cat.id === def.id)).map(d => d.id)
    const backupData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      markers: markers,
      carLocation: carLocation,
      customCategories: customCategories,
      removedDefaults: removedDefaults,
      appName: "Min Svampkarta"
    }
    
    const dataStr = JSON.stringify(backupData, null, 2)
    console.log('Backup data prepared, length:', dataStr.length)
    // If running as a Capacitor native app, use Filesystem + Share to save the file to Downloads
    try {
      // @ts-ignore
      const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform()
      console.log('isNative:', isNative)
      if (isNative) {
        console.log('Attempting native backup')
        // Use dynamic imports so this code still builds for web
        // Import using any-typed fallbacks to avoid TypeScript errors when types are not installed
        let Filesystem: any = null
        let Directory: any = null
        let Share: any = null
        try {
          console.log('Importing Capacitor plugins...')
          const fsMod = await import('@capacitor/filesystem').catch(() => null)
          if (fsMod) {
            // support different module shapes
            Filesystem = fsMod.Filesystem || fsMod.default?.Filesystem || fsMod
            Directory = fsMod.Directory || fsMod.default?.Directory || fsMod.Directory
          }
        
          const shareMod = await import('@capacitor/share').catch(() => null)
          if (shareMod) {
            Share = shareMod.Share || shareMod.default?.Share || shareMod
          }
          console.log('Filesystem available:', !!Filesystem, 'Share available:', !!Share, 'Directory available:', !!Directory)
        } catch (e) {
          console.error('Error importing plugins:', e)
          // ignore import errors and fall back to web download below
        }

        if (!Filesystem || !Share || !Directory) {
          throw new Error('Capacitor Filesystem/Share not available')
        }

        const fileName = `svampkartan-backup-${new Date().toISOString().split('T')[0]}.json`
        console.log('Writing file:', fileName)

        // Write to temporary app data directory
        await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: 'utf8'
        })
        console.log('File written successfully')

        // Get a URI we can share (native path)
        const uriResult = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
        console.log('URI obtained:', uriResult.uri)

        // Share the file so user can save it to Downloads or other location
        await Share.share({
          title: 'Min Svampkarta backup',
          text: 'Säkerhetskopiera dina fynd',
          url: uriResult.uri
        })
        console.log('File shared successfully')

        setShowBackupDialog(false)
        return
      }
    } catch (nativeErr) {
      // If any native operation fails, fall back to browser download
      console.warn('Native backup failed, falling back to web download', nativeErr)
    }

    console.log('Using web fallback download')
    // Web fallback: trigger anchor download
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `svampkartan-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    setShowBackupDialog(false)
  }

  const importFinds = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // Strip potential BOM and trim whitespace before parsing
        const rawText = (e.target?.result as string) || ''
        const cleaned = rawText.replace(/^\uFEFF/, '').trim()
        const backupData = JSON.parse(cleaned)

        // Locate markers array (be tolerant to variations in export format)
        let markersArray: any[] | null = null
        if (Array.isArray(backupData.markers)) {
          markersArray = backupData.markers
        } else if (backupData.markers && typeof backupData.markers === 'object') {
          // Coerce object map to array
          markersArray = Object.values(backupData.markers)
        } else {
          // Search for any top-level array property that likely contains markers
          for (const k of Object.keys(backupData)) {
            if (Array.isArray((backupData as any)[k])) {
              markersArray = (backupData as any)[k]
              break
            }
          }
        }

        if (markersArray && Array.isArray(markersArray)) {
          // Restore markers with backward compatibility for category field
          const markersWithCategories = markersArray.map((marker: any) => ({
            ...marker,
            category: marker.category || 'edible' // Default to 'edible' if category is missing
          }))
          
          // Merge with existing markers - only add new ones, don't replace existing
          setMarkers(currentMarkers => {
            const existingIds = new Set(currentMarkers.map(m => `${m.lat}-${m.lng}-${m.name}`))
            const newMarkers = markersWithCategories.filter((marker: any) => 
              !existingIds.has(`${marker.lat}-${marker.lng}-${marker.name}`)
            )
            const mergedMarkers = [...currentMarkers, ...newMarkers]
            localStorage.setItem('svampkartan-markers', JSON.stringify(mergedMarkers))
            return mergedMarkers
          })
          
          // Restore car location if exists
          if (backupData.carLocation) {
            setCarLocation(backupData.carLocation)
            localStorage.setItem('svampkartan-car-location', JSON.stringify(backupData.carLocation))
          }
          
          // Restore custom categories if exists - merge, don't replace
          if (backupData.customCategories) {
            setCategories(currentCategories => {
              const removed = backupData.removedDefaults || []
              const base = DEFAULT_CATEGORIES.filter((def: any) => !removed.includes(def.id))
              const mergedCategories = [...currentCategories]
              
              // Add new categories that don't already exist
              backupData.customCategories.forEach((c: any) => {
                const existingIdx = mergedCategories.findIndex((x: any) => x.id === c.id)
                if (existingIdx >= 0) {
                  // Update existing category
                  mergedCategories[existingIdx] = c
                } else {
                  // Add new category
                  mergedCategories.push(c)
                }
              })
              
              saveCategoriesToStorage(mergedCategories)
              return mergedCategories
            })
          }
          
          const importedCount = markersWithCategories.length
          alert(`✅ Backup sammanfogad! ${importedCount} fynd från backup (nya fynd lades till, befintliga behölls).`)
          setShowBackupDialog(false)
        } else {
          console.error('Invalid backup format, parsed object:', backupData)
          alert('❌ Ogiltig backup-fil. Kontrollera att filen kommer från Min Svampkarta.')
        }
      } catch (error) {
        alert('❌ Kunde inte läsa backup-filen. Kontrollera att den är giltig.')
        console.error('Import error:', error)
      }
    }
    
    reader.readAsText(file)
    // Reset the input
    event.target.value = ''
  }

  // Category Management Functions
  const saveCategoriesToStorage = (categoriesList: any[]) => {
    if (typeof window !== 'undefined') {
      // Persist as structured object to support overrides and removed defaults
      const customCategories = categoriesList.filter(cat => !DEFAULT_CATEGORIES.find(def => def.id === cat.id))
      const removedDefaults = DEFAULT_CATEGORIES.filter(def => !categoriesList.find(cat => cat.id === def.id)).map(d => d.id)
      const payload = { customCategories, removedDefaults }
      localStorage.setItem('svampkartan-categories', JSON.stringify(payload))
    }
  }

  const addNewCategory = () => {
    if (!newCategoryForm.name.trim()) {
      alert('❌ Kategorinamn är obligatoriskt')
      return
    }

    if (isEditMode && editingCategory) {
      // Update existing category
      const updatedCategories = categories.map(cat => 
        cat.id === editingCategory.id 
          ? { ...cat, name: newCategoryForm.name.trim(), emoji: newCategoryForm.emoji }
          : cat
      )
      
      setCategories(updatedCategories)
      saveCategoriesToStorage(updatedCategories)
      alert(`✅ Kategorin har uppdaterats!`)
      
      // Reset form but keep dialog open in add mode
      setNewCategoryForm({ name: '', emoji: '🍄' })
      setIsEditMode(false)
      setEditingCategory(null)
    } else {
      // Add new category
      const categoryId = newCategoryForm.name.toLowerCase().replace(/[åäö]/g, (match) => 
        match === 'å' ? 'a' : match === 'ä' ? 'a' : 'o'
      ).replace(/[^a-z0-9]/g, '')

      if (categories.find(cat => cat.id === categoryId)) {
        alert('❌ En kategori med detta namn finns redan')
        return
      }

      const newCategory = {
        id: categoryId,
        name: newCategoryForm.name.trim(),
        emoji: newCategoryForm.emoji,
        color: 'green' // Default color for all custom categories
      }

      const updatedCategories = [...categories, newCategory]
      setCategories(updatedCategories)
      saveCategoriesToStorage(updatedCategories)
      alert(`✅ Kategorin "${newCategory.name}" har lagts till!`)
      
      // Reset form but keep dialog open
      setNewCategoryForm({ name: '', emoji: '🍄' })
    }
  }

  const cancelAddCategory = () => {
    setNewCategoryForm({ name: '', emoji: '🍄' })
    setShowAddCategoryDialog(false)
    setIsEditMode(false)
    setEditingCategory(null)
  }

  const startEditCategory = (category: any) => {
    setEditingCategory(category)
    setNewCategoryForm({ name: category.name, emoji: category.emoji })
    setIsEditMode(true)
    setShowAddCategoryDialog(true)
  }

  const deleteCategory = (categoryId: string) => {
    const isDefault = !!DEFAULT_CATEGORIES.find(cat => cat.id === categoryId)
    const confirmMsg = isDefault
      ? 'Detta är en standardkategori. Om du tar bort den kommer den att tas bort från listan och fynd som använder den kommer att få kategorin "Okända". Vill du fortsätta?'
      : 'Är du säker på att du vill ta bort denna kategori?'

    if (!confirm(confirmMsg)) return

    // Remove the category from the list
    const updatedCategories = categories.filter(cat => cat.id !== categoryId)
    setCategories(updatedCategories)
    saveCategoriesToStorage(updatedCategories)

    // Update markers that use this category to use the 'unknown' category
    const updatedMarkers = markers.map(marker => 
      marker.category === categoryId
        ? { ...marker, category: (DEFAULT_CATEGORIES.find(d => d.id === 'unknown')?.id || 'unknown') }
        : marker
    )
    setMarkers(updatedMarkers)
    localStorage.setItem('svampkartan-markers', JSON.stringify(updatedMarkers))

    alert('✅ Kategorin har tagits bort')
  }

  const cancelAddMarker = () => {
    setIsAddingMarker(false)
    setPendingMarker(null)
    setNewMarkerForm({ name: '', notes: '', abundance: 3, category: 'unknown' })
  }

  const handleDeleteMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id))
    setSelectedMarker(null)
  }

  const handleEditMarker = (marker: MushroomMarker) => {
    setEditForm({ name: marker.name, notes: marker.notes || '', abundance: marker.abundance || 3, category: marker.category || 'edible' })
    setIsEditingMarker(true)
  }

  const saveEditedMarker = () => {
    if (!selectedMarker || !editForm.name.trim()) return
    
    const updatedMarkers = markers.map(marker => 
      marker.id === selectedMarker.id 
        ? { ...marker, name: editForm.name.trim(), notes: editForm.notes.trim(), abundance: editForm.abundance, category: editForm.category }
        : marker
    )
    
    setMarkers(updatedMarkers)
    setSelectedMarker(null)
    setIsEditingMarker(false)
    setEditForm({ name: '', notes: '', abundance: 3, category: 'edible' })
  }

  const cancelEdit = () => {
    setIsEditingMarker(false)
    setEditForm({ name: '', notes: '', abundance: 3, category: 'edible' })
  }

  const zoomToUserLocation = () => {
    console.log('Location button clicked!')
    console.log('Current userLocation:', userLocation)
    
    if (userLocation && mapRef.current) {
      console.log('Zooming to user location:', userLocation)
      // Zoom to current user location
      // Jump instantly to user location (no animation) to avoid overlay jitter during animated map moves
      mapRef.current.setView([userLocation.lat, userLocation.lng], 16, {
        animate: false
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
      <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-r from-green-500/80 to-emerald-600/80 backdrop-blur-md border-b border-white/20 shadow-lg z-[50000]">
        <div className="flex items-center justify-between h-full px-4">
          <h1 className="text-white font-semibold text-lg">Min Svamp- och bärkarta</h1>
          
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
          <div className="absolute top-full right-2 sm:right-4 mt-0.5 bg-white/95 backdrop-blur-md rounded-lg sm:rounded-xl shadow-2xl border border-white/20 min-w-40 sm:min-w-48 py-0.5 sm:py-1 max-h-[80vh] overflow-y-auto" style={{ zIndex: 50000 }} onClick={e => e.stopPropagation()}>
            <div className="px-3 sm:px-4 py-1 sm:py-1 text-gray-700 text-sm sm:text-base border-b border-gray-200/50">
              <div className="font-semibold text-emerald-700">Meny</div>
            </div>
            <div className="py-0 sm:py-0">
              <button 
                onClick={() => {
                  // Cancel walking navigation when opening finds list
                  if (showWalkingDirection) {
                    hideWalkingDirection()
                  }
                  setShowFindsList(true)
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">📋</span>
                <span className="font-medium text-xs sm:text-sm">Mina fynd</span>
              </button>
              <button 
                onClick={() => {
                  setShowCategoryFilter(true)
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">🏷️</span>
                <span className="font-medium text-xs sm:text-sm">Välj kategorier</span>
              </button>
              <button 
                onClick={() => {
                  startMeasuring()
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">📏</span>
                <span className="font-medium text-xs sm:text-sm">Mät avstånd</span>
              </button>
              <button
                onClick={() => {
                  setShowAddCategoryDialog(true)
                  setIsEditMode(false)
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">✏️</span>
                <span className="font-medium text-xs sm:text-sm">Redigera kategorier</span>
              </button>
              <button
                onClick={() => setShowMapTypeModal(true)}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">🗺️</span>
                <span className="font-medium text-xs sm:text-sm">Karttyp</span>
              </button>
              <button 
                onClick={() => {
                  setShowBackupDialog(true)
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">💾</span>
                <span className="font-medium text-xs sm:text-sm">Säkerhetskopiera</span>
              </button>
              <button 
                onClick={() => {
                  setShowCredits(true)
                  setShowMenu(false)
                }}
                className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3"
              >
                <span className="text-base sm:text-lg">ℹ️</span>
                <span className="font-medium text-xs sm:text-sm">Om appen</span>
              </button>
              <label className="w-full px-3 sm:px-4 py-1 sm:py-1 text-left text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-2 sm:gap-3 cursor-pointer">
                <input
                  type="file"
                  accept=".gpx"
                  onChange={(e) => {
                    importGPXFile(e)
                    setShowMenu(false)
                  }}
                  className="hidden"
                  id="gpx-import-menu"
                />
                <span className="text-base sm:text-lg">📁</span>
                <span className="font-medium text-xs sm:text-sm">Importera GPX</span>
              </label>
            </div>
            {/* Spacer för att sista menyvalet alltid ska gå att skrolla fram */}
            <div style={{ height: 30, pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      {/* Welcome Popup - Only shows once */}
      {/* Karttyp Modal */}
      {showMapTypeModal && (
        <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-emerald-200 animate-fade-in">
            <h2 className="text-lg font-semibold text-emerald-700 mb-4 text-center">Välj karttyp</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => { changeMapType('opentopo'); setShowMapTypeModal(false); }} className={`py-2 rounded text-left text-sm ${currentMapType === 'opentopo' ? 'bg-green-100 text-green-800 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>OpenTopo</button>
              <button onClick={() => { changeMapType('mml-topo'); setShowMapTypeModal(false); }} className={`py-2 rounded text-left text-sm ${currentMapType === 'mml-topo' ? 'bg-green-100 text-green-800 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>MML Topo (FIN)</button>
              <button onClick={() => { changeMapType('mml-satellite'); setShowMapTypeModal(false); }} className={`py-2 rounded text-left text-sm ${currentMapType === 'mml-satellite' ? 'bg-green-100 text-green-800 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>MML Satellite (FIN)</button>
              <button onClick={() => { changeMapType('lantmateriet'); setShowMapTypeModal(false); }} className={`py-2 rounded text-left text-sm ${currentMapType === 'lantmateriet' ? 'bg-green-100 text-green-800 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>Lantmäteriet Topo (SWE)</button>
              <button onClick={() => { changeMapType('lantmateriet-satellite'); setShowMapTypeModal(false); }} className={`py-2 rounded text-left text-sm ${currentMapType === 'lantmateriet-satellite' ? 'bg-green-100 text-green-800 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>Lantmäteriet Sat (SWE)</button>
            </div>
            <button className="mt-6 w-full py-2 rounded-xl bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition" onClick={() => setShowMapTypeModal(false)}>Stäng</button>
          </div>
        </div>
      )}
      {showWelcome && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-xs w-full text-center border border-emerald-200 animate-fade-in">
            <div className="text-5xl mb-3">🍄</div>
            <h2 className="text-xl font-bold text-emerald-700 mb-2">Välkommen till Min Svamp- och bärkarta!</h2>
            <p className="text-gray-700 mb-4 text-base">Vid problem, kontakta mig på de uppgifter som finns på fliken: <b>Om appen</b>.</p>
            <button
              className="mt-2 px-6 py-2 rounded-xl bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-600 transition"
              onClick={() => setShowWelcome(false)}
            >
              Jag är redo att börja!
            </button>
          </div>
        </div>
      )}
      {/* Floating Add Button - Enhanced Animations */}
  <div className="fixed bottom-4 right-8" style={{ zIndex: 10000 }}>
  <div className="relative flex flex-col gap-6">
      {/* Pulse ring animation */}
      <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
        !isAddingMarker ? 'animate-ping bg-emerald-400 opacity-20' : ''
      }`}></div>
      <button
        onClick={() => {
          // Prevent add marker during walking navigation
          if (showWalkingDirection) {
            return
          }
          if (isAddingMarker) {
            setIsAddingMarker(false)
            setPendingMarker(null)
          } else {
            setShowAddChoiceDialog(true)
          }
        }}
        className={`relative w-12 h-12 rounded-full text-white text-lg font-light shadow-2xl transition-all duration-300 transform backdrop-blur-sm border border-opacity-20 hover:scale-110 active:scale-95 flex items-center justify-center ${
          isAddingMarker
            ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rotate-45 border-red-300 animate-pulse'
            : showWalkingDirection
              ? 'bg-gradient-to-br from-gray-400 to-gray-500 border-gray-300 opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 hover:shadow-3xl border-emerald-300 hover:animate-bounce'
        }`}
        style={{
          boxShadow: isAddingMarker
            ? '0 20px 40px rgba(239, 68, 68, 0.3), 0 8px 16px rgba(239, 68, 68, 0.2)'
            : showWalkingDirection
              ? '0 10px 20px rgba(107, 114, 128, 0.3), 0 4px 8px rgba(107, 114, 128, 0.2)'
              : '0 20px 40px rgba(16, 185, 129, 0.3), 0 8px 16px rgba(16, 185, 129, 0.2)',
          animation: !isAddingMarker && !showWalkingDirection ? 'float 3s ease-in-out infinite' : ''
        }}
        title={showWalkingDirection ? "Inte tillgängligt under navigation" : (isAddingMarker ? "Avbryt" : "Lägg till fynd")}
      >
        <span className={`block transition-transform duration-300 ${isAddingMarker ? 'rotate-45' : ''}`}>
          +
        </span>
        {/* Ripple effect background */}
        <div className={`absolute inset-0 rounded-full bg-white bg-opacity-10 transition-all duration-300 ${
          isAddingMarker ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
        }`}></div>
      </button>
    </div>
  </div>

      {/* Floating Car Controls - Bottom */}
  <div className="fixed top-28 right-2" style={{ zIndex: 10000 }}>
  {/* Main Car Button */}
    <button
      onClick={toggleCarControls}
      className={`relative w-12 h-12 rounded-full shadow-lg transition-all duration-300 border-2 flex items-center justify-center ${
        'bg-black/60 border-white' +
        (isParkingMode ? ' animate-pulse' : '') +
        (showWalkingDirection ? ' opacity-50 cursor-not-allowed' : '') +
        ' active:scale-95'
      } ${showWalkingDirection ? 'opacity-50 cursor-not-allowed' : ''} active:scale-95`}
      title={
        showWalkingDirection ? "Inte tillgängligt under navigation" :
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
          <div className="absolute top-1/2 transform -translate-y-1/2 right-16 flex flex-row gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 z-[50000]">
            {/* Find Car Button */}
            <button 
              onClick={findCar}
              className={`w-8 h-8 rounded-full shadow-md transition-all duration-200 border-2 flex items-center justify-center active:scale-90 ${
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
              className="w-8 h-8 rounded-full shadow-md transition-all duration-200 border-2 bg-red-600 border-red-400 shadow-red-600/30 hover:shadow-red-600/50 active:scale-90 flex items-center justify-center"
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

      {/* Measuring Tool UI */}
      {isMeasuring && !showMeasureComplete && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-2xl border border-white/20" style={{ zIndex: 15000 }}>
          <div className="text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📏</span>
              <span className="font-semibold text-gray-800">Mät avstånd</span>
            </div>
            {measurePoints.length === 0 ? (
              <p className="text-sm text-gray-600">Klicka på kartan för att sätta första punkten</p>
            ) : measurePoints.length === 1 ? (
              <p className="text-sm text-gray-600">Klicka för att sätta nästa punkt</p>
            ) : (
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {formatDistance(totalMeasureDistance)}
                </div>
                <p className="text-xs text-gray-600">{measurePoints.length} punkter</p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-3">
            {measurePoints.length > 0 && (
              <button
                onClick={undoLastMeasurePoint}
                className="flex-1 px-3 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 active:scale-95 transition-all text-sm font-medium"
              >
                ↶ Ångra
              </button>
            )}
            {measurePoints.length >= 2 && (
              <button
                onClick={completeMeasuring}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all text-sm font-medium"
              >
                ✓ Klar
              </button>
            )}
            <button
              onClick={cancelMeasuring}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-500 text-white hover:bg-gray-600 active:scale-95 transition-all text-sm font-medium"
            >
              ✕ Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Measure Complete Dialog */}
      {showMeasureComplete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 max-w-sm w-full border border-white/20 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">📏</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Mätning klar!</h3>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatDistance(totalMeasureDistance)}
              </div>
              <p className="text-gray-600 text-sm">{measurePoints.length} punkter</p>
            </div>

            {/* Route Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Namn på rutt (valfritt)
              </label>
              <input
                type="text"
                value={measureRouteName}
                onChange={(e) => setMeasureRouteName(e.target.value)}
                placeholder="T.ex. Min vandring"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  exportMeasureAsGPX()
                  setShowMeasureComplete(false)
                  cancelMeasuring()
                }}
                className="w-full p-4 rounded-2xl border-2 bg-blue-500 border-blue-400 text-white hover:bg-blue-600 active:scale-95 transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xl">💾</span>
                  <div className="text-left">
                    <div className="font-medium">Spara som GPX</div>
                    <div className="text-sm opacity-80">Exportera till fil</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowMeasureComplete(false)
                  cancelMeasuring()
                }}
                className="w-full p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all duration-200 font-medium"
              >
                ✓ Klar
              </button>

              <button
                onClick={() => {
                  setShowMeasureComplete(false)
                }}
                className="w-full p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200"
              >
                ← Fortsätt mäta
              </button>
            </div>

            {/* Import GPX Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block">
                <input
                  type="file"
                  accept=".gpx"
                  onChange={importGPXFile}
                  className="hidden"
                  id="gpx-import-complete"
                />
                <div className="cursor-pointer w-full p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all duration-200 text-center font-medium">
                  📁 Importera GPX-fil
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Finds List Modal */}
      {showFindsList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 20000 }}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Mina fynd</h3>
              <button
                onClick={() => setShowFindsList(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Category Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrera efter kategori
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">🍄 Alla kategorier</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.emoji} {category.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh] -webkit-overflow-scrolling-touch overscroll-contain pb-8 pt-2">
              {markers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🍄</div>
                  <p>Inga fynd registrerade än</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {markers
                    .filter(marker => selectedCategory === 'all' || marker.category === selectedCategory)
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
                              // Ensure this marker becomes selected and rendered even if its category is hidden
                              // Cancel any existing navigation (walking/car) when selecting a new target
                              clearExistingNavigation()
                              // but do NOT open the details modal - just select it so the map shows the pin.
                              setSelectedMarker(marker)
                              setShowMarkerDetails(false)
                              setShowFindsList(false)
                            }
                          }}
                          className="w-full p-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Left side - Icon and Name */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {(() => {
                                  const category = categories.find(cat => cat.id === marker.category) || categories[0]
                                  return <span className="text-lg">{category.emoji}</span>
                                })()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-gray-800 hover:text-blue-600 transition-colors truncate">
                                  {marker.name}
                                </div>
                                {/* Abundance dots below name */}
                                <div className="flex items-center gap-1 mt-1">
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
                            </div>
                            {/* Right side - Distance */}
                            <div className="text-right flex-shrink-0">
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
                  💡 Aktivera platsåtkomst för att se avstånd till fynd
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filter Dialog */}
      {showCategoryFilter && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3" style={{ zIndex: 20000 }}>
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full max-h-[78vh] overflow-hidden shadow-lg mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-800">Filtrera kategorier</h3>
              <button
                onClick={() => setShowCategoryFilter(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              Välj vilka kategorier som ska visas på kartan
            </p>

            <div className="space-y-1 max-h-[60vh] overflow-y-auto pb-2">
              {categories.map(cat => (
                <label 
                  key={cat.id} 
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleCategoryIds.includes(cat.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setVisibleCategoryIds(ids => [...ids, cat.id]);
                      } else {
                        setVisibleCategoryIds(ids => ids.filter(id => id !== cat.id));
                      }
                    }}
                    className="w-4 h-4 accent-green-500"
                  />
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="font-medium text-gray-800 text-sm flex-1 truncate">{cat.name}</span>
                  <span className="text-xs text-gray-500">
                    {markers.filter(m => m.category === cat.id).length} fynd
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setVisibleCategoryIds(getAllCategoryIds(categories))}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Visa alla
              </button>
              <button
                onClick={() => setShowCategoryFilter(false)}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-colors text-sm"
              >
                Klar
              </button>
            </div>
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
              <p className="text-lg text-gray-600">{navigationTarget.name}</p>              ngrok http 3444 --log=stdout              ngrok http 3444 --log=stdout
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
                  
                  // Zoom to show both user and target position immediately
                  if (mapRef.current && navigationTarget) {
                    const bounds = L.latLngBounds([
                      [userLocation.lat, userLocation.lng],
                      [navigationTarget.lat, navigationTarget.lng]
                    ])
                    
                    // Fit bounds with larger padding for better context
                    if (!isUserPanning.current) {
                      mapRef.current.fitBounds(bounds, {
                        padding: [30, 30],
                        animate: true,
                        duration: 1,
                        maxZoom: 15
                      })
                    }
  // Återställ flagga när navigation startar/avslutas
  useEffect(() => {
    isUserPanning.current = false;
  }, [navigationTarget]);
                  }
                  
                  // Draw line after a short delay to ensure state is updated
                  setTimeout(() => {
                    updateWalkingDirectionLine(false) // Don't zoom again since we just did
                  }, 100)
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
  <div className="fixed top-14 right-2" style={{ zIndex: 10000 }}>
  <button
      onClick={zoomToUserLocation}
  className="w-12 h-12 rounded-full shadow-lg transition-all duration-300 border-2 bg-black/60 border-white active:scale-95 flex items-center justify-center"
      title="Hitta min position"
    >
      <span className="text-xl leading-none">📍</span>
    </button>
  </div>

      {/* Navigation Cancel Button - centered at bottom for both walking and car navigation */}
      {(showWalkingDirection || showCarDirection) && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2" style={{ zIndex: 10000 }}>
          <button 
            onClick={() => {
              if (showWalkingDirection) hideWalkingDirection();
              if (showCarDirection) {
                setShowCarDirection(false);
                setCurrentCarDistance(null);
                if (carDirectionLine && mapRef.current) {
                  mapRef.current.removeLayer(carDirectionLine);
                  setCarDirectionLine(null);
                }
              }
            }}
            className="px-6 py-3 rounded-full shadow-lg transition-all duration-300 border-2 bg-red-500 border-red-300 text-white text-sm font-medium hover:bg-red-600 active:scale-95"
          >
            Avbryt navigering
          </button>
        </div>
      )}






      {/* Kartval i menyn */}
      {/* Lägg till i dropdown-menyn under "Meny" */}

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
            <h3 className="text-xl font-semibold mb-4">Lägg till fynd</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Art *
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
                  Kategori
                </label>
                <select
                  value={newMarkerForm.category}
                  onChange={(e) => setNewMarkerForm({ ...newMarkerForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.emoji} {category.name}
                    </option>
                  ))}
                </select>
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
                  Mängd
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
  {selectedMarker && showMarkerDetails && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 10001 }}
            onClick={() => {
              setSelectedMarker(null)
              setShowMarkerDetails(false)
            }}
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
                      // Clear any existing navigation first
                      clearExistingNavigation()
                      
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
                      
                      // Clear any existing navigation first
                      clearExistingNavigation()
                      
                      setNavigationTarget(selectedMarker)
                      setShowWalkingDirection(true)
                      setSelectedMarker(null)
                      setNavigationLineAnimated(true)
                      setTimeout(() => setNavigationLineAnimated(false), 1000)
                      // Use setTimeout to ensure state is updated before calling the function
                      setTimeout(() => {
                        updateWalkingDirectionLine(true) // Enable zoom on initial setup
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
                  onClick={() => {
                    setSelectedMarker(null)
                    setShowMarkerDetails(false)
                  }}
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
                    Art
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
                    Kategori
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.emoji} {category.name}
                      </option>
                    ))}
                  </select>
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
                    Mängd
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
            <h3 className="text-xl font-semibold mb-4 text-center">Lägg till fynd</h3>
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
            <span className="font-semibold text-lg">Fynd tillagt!</span>
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
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Min svamp- och bärkarta</h2>
              <p className="text-gray-500 mb-8 text-sm">Din personliga svamp- och bärfyndskarta</p>
              
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

      {/* Backup/Restore Dialog */}
      {showBackupDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 10003 }}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              {/* Backup Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <span className="text-3xl">💾</span>
              </div>
              
              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Säkerhetskopiera</h2>
              <p className="text-gray-500 mb-8 text-sm">Spara eller återställ dina fynd</p>
              
              {/* Action Buttons */}
              <div className="space-y-4 mb-6">
                <button 
                  onClick={exportFinds}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-green-500/25 flex items-center justify-center gap-3"
                >
                  <span>📥</span>
                  Ladda ner backup
                </button>
                
                <label className="block">
                  <input
                    type="file"
                    accept=".json"
                    onChange={importFinds}
                    className="hidden"
                  />
                  <div className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-3">
                    <span>📤</span>
                    Återställ backup
                  </div>
                </label>
              </div>
              
              {/* Info Text */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 mb-6 text-left">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>💾 Ladda ner:</strong> Sparar alla dina fynd och bil-position i en fil
                </p>
                <p className="text-sm text-gray-600">
                  <strong>📤 Återställ:</strong> Läs in en tidigare sparad backup-fil
                </p>
              </div>
              
              {/* Close Button */}
              <button 
                onClick={() => setShowBackupDialog(false)}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 px-6 rounded-xl font-medium hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Dialog */}
      {showAddCategoryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60001] p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full mx-2 sm:mx-4 shadow-2xl transform transition-all duration-300 max-w-[min(95vw,700px)] max-h-[90vh]">
            <div className="p-3 sm:p-4 lg:p-6 max-h-[86vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                  Redigera kategorier
                </h3>
                <button
                  onClick={cancelAddCategory}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-sm sm:text-base"
                >
                  ✕
                </button>
              </div>

              {/* Existing Categories Section */}
              <div className="mb-6 sm:mb-8">
                <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Befintliga kategorier</h4>
                <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-3 sm:py-4 text-sm sm:text-base">Inga kategorier</p>
                  ) : (
                    categories.map(category => {
                      const isDefault = !!DEFAULT_CATEGORIES.find(def => def.id === category.id)
                      return (
                        <div key={category.id} className="flex items-center justify-between py-0 px-2 sm:py-0.5 sm:px-2 bg-gray-50 rounded-lg min-w-0">
                          <div className="flex items-center gap-2 sm:gap-2 min-w-0 flex-1">
                            <span className="text-sm sm:text-base flex-shrink-0 w-6 h-6 flex items-center justify-center">{category.emoji}</span>
                            <span className="font-medium text-gray-800 text-sm truncate">{category.name}</span>
                            {isDefault && <span className="ml-2 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Standard</span>}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <button
                              onClick={() => startEditCategory(category)}
                              className="w-8 h-6 sm:w-10 sm:h-6 px-2 bg-blue-500 text-white text-xs sm:text-sm rounded sm:rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                              title={`Redigera ${category.name}`}
                              aria-label={`Redigera ${category.name}`}
                            >
                              <span className="text-sm sm:text-base">✏️</span>
                            </button>
                            <button
                              onClick={() => deleteCategory(category.id)}
                              className="w-8 h-6 sm:w-10 sm:h-6 px-2 bg-red-500 text-white text-xs sm:text-sm rounded sm:rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                              title={`Ta bort ${category.name}`}
                              aria-label={`Ta bort ${category.name}`}
                            >
                              <span className="text-sm sm:text-base">🗑️</span>
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Add/Edit Category Form */}
              <div className="border-t pt-4 sm:pt-6">
                <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                  {isEditMode ? 'Redigera kategori' : 'Lägg till ny kategori'}
                </h4>
                
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Kategorinamn *
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 border border-gray-300 rounded-md flex items-center justify-center bg-gray-50 text-base sm:text-lg flex-shrink-0">
                        {newCategoryForm.emoji}
                      </div>
                      <input
                        type="text"
                        value={newCategoryForm.name}
                        onChange={(e) => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                        placeholder="t.ex. Medicinsk..."
                        className="flex-1 min-w-0 px-2 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Välj emoji
                    </label>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {['🍄', '💀', '⭐',  '❓', '🍓', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setNewCategoryForm({ ...newCategoryForm, emoji })}
                          className={`w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-lg hover:bg-gray-100 rounded border transition-colors flex items-center justify-center ${
                            newCategoryForm.emoji === emoji ? 'border-green-500 bg-green-50' : 'border-gray-200'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex mt-4 sm:mt-6">
                  <button
                    onClick={addNewCategory}
                    disabled={!newCategoryForm.name.trim()}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {isEditMode ? 'Spara ändringar' : 'Lägg till kategori'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
