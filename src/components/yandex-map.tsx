"use client"

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Script from 'next/script'
import {CameraData, camerasData} from "@/components/CameraModal/cameraModal.props";
import {fleetData, VehicleData} from "@/components/FleetManagement/FleetManagement.props";
import {CameraModal} from "@/components/CameraModal/camera-modal";
import {Button} from "@/components/button/button";
import {useMapView} from "@/context/MapViewContext";

declare global {
  interface Window {
    ymaps: typeof import('yandex-maps')
  }
}

export function YandexMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<ymaps.Map | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null)
  const [trafficShown, setTrafficShown] = useState(false)
  const { setCurrentView } = useMapView()

  useEffect(() => {
    let yMap: ymaps.Map | null = null

    const initMap = () => {
      if (window.ymaps && mapRef.current && !yMap) {
        window.ymaps.ready(() => {
          yMap = new window.ymaps.Map(mapRef.current!, {
            center: [45.035470, 38.975313], // Краснодар
            zoom: 12,
            controls: ['zoomControl', 'fullscreenControl']
          })
          setMap(yMap)

          // Добавляем метки для всех камер
          camerasData.forEach(camera => addCameraMarker(yMap!, camera))

          // Добавляем метки для всех транспортных средств
          fleetData.forEach(vehicle => addVehicleMarker(yMap!, vehicle))

          // Обновляем контекст при изменении вида карты
          yMap.events.add('boundschange', () => {
            const center = yMap!.getCenter()
            const zoom = yMap!.getZoom()
            setCurrentView({ center, zoom })
          })
        })
      }
    }

    if (window.ymaps) {
      initMap()
    } else {
      const yandexApiLoaded = () => {
        initMap()
        window.removeEventListener('yandexApiLoaded', yandexApiLoaded)
      }
      window.addEventListener('yandexApiLoaded', yandexApiLoaded)
    }

    return () => {
      if (yMap) {
        yMap.destroy()
        setMap(null)
      }
    }
  }, [setCurrentView])

  const addCameraMarker = (yMap: ymaps.Map, camera: CameraData) => {
    const placemark = new window.ymaps.Placemark(camera.location, {
      balloonContent: `
        <strong>Камера ${camera.id}</strong><br>
        Адрес: ${camera.address}<br>
        Статус: ${camera.status}<br>
        <button id="openCamera${camera.id}" style="margin-top: 10px; padding: 5px 10px; background: #0ea5e9; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Открыть камеру
        </button>
      `
    }, {
      preset: 'islands#blueVideoIcon'
    })

    placemark.events.add('balloonopen', () => {
      setTimeout(() => {
        const button = document.getElementById(`openCamera${camera.id}`)
        if (button) {
          button.onclick = () => {
            setSelectedCamera(camera)
            placemark.balloon.close()
          }
        }
      }, 100)
    })

    yMap.geoObjects.add(placemark)
  }

  const addVehicleMarker = (yMap: ymaps.Map, vehicle: VehicleData) => {
    const placemark = new window.ymaps.Placemark(vehicle.currentLocation, {
      balloonContent: `
        <strong>${vehicle.vehicleNumber}</strong><br>
        Статус: ${vehicle.status}<br>
        Последнее обновление: ${vehicle.lastUpdate}
      `
    }, {
      preset: 'islands#blueAutoIcon'
    })

    yMap.geoObjects.add(placemark)
  }

  const toggleTraffic = () => {
    if (map) {
      if (!trafficShown) {
        map.controls.add('trafficControl')
        const trafficControl = map.controls.get('trafficControl')
        trafficControl.showTraffic()
      } else {
        const trafficControl = map.controls.get('trafficControl')
        if (trafficControl) {
          trafficControl.hideTraffic()
          map.controls.remove('trafficControl')
        }
      }
      setTrafficShown(!trafficShown)
    }
  }

  const searchAddress = () => {
    if (map && searchQuery) {
      window.ymaps.geocode(searchQuery, {
        results: 1
      }).then((res: any) => {
        const firstGeoObject = res.geoObjects.get(0)
        if (firstGeoObject) {
          const coords = firstGeoObject.geometry.getCoordinates()
          map.setCenter(coords, 15)
          map.balloon.open(coords, {
            contentHeader: searchQuery,
            contentBody: firstGeoObject.getAddressLine()
          })
        }
      })
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    if (value.length > 2) {
      window.ymaps.suggest(value).then((items: any[]) => {
        setSuggestions(items.map(item => item.value))
      })
    } else {
      setSuggestions([])
    }
  }

  return (
    <Card className="w-full h-full relative p-4">
      <Script
        src={`https://api-maps.yandex.ru/2.1/?apikey=5f51e1d5-be08-49e6-815f-23757de1bd43&lang=ru_RU`}
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event('yandexApiLoaded'))}
      />
      <div className="mb-4 flex gap-2 flex-wrap">
        <div className="relative flex-grow">
          <Input
            type="text"
            placeholder="Поиск по адресу"
            value={searchQuery}
            onChange={handleSearchInputChange}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-background border rounded-md shadow-lg mt-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    setSearchQuery(suggestion)
                    setSuggestions([])
                    searchAddress()
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button onClick={searchAddress}>Поиск</Button>
        <Button onClick={toggleTraffic}>
          {trafficShown ? 'Скрыть пробки' : 'Показать пробки'}
        </Button>
      </div>
      <div ref={mapRef} className="w-full h-[calc(100%-60px)] rounded-lg overflow-hidden" />
      <CameraModal
        camera={selectedCamera}
        onClose={() => setSelectedCamera(null)}
      />
    </Card>
  )
}
