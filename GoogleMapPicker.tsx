import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/googleMaps";

interface GoogleMapPickerProps {
  onLocationSelect: (data: {
    lat: number;
    lng: number;
    address: string;
    ward: string;
  }) => void;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  height?: string;
  initialCoords?: { lat: number; lng: number } | null;
}

export default function GoogleMapPicker({
  onLocationSelect,
  defaultCenter = { lat: 21.2514, lng: 81.6296 },
  defaultZoom = 14,
  height = "300px",
  initialCoords,
}: GoogleMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [apiKey, setApiKey] = useState("");

  const geocoderRef = useRef<any>(null);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!window.google?.maps) {
        onLocationSelect({ lat, lng, address: "", ward: "" });
        return;
      }
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
      geocoderRef.current.geocode(
        { location: { lat, lng } },
        (results: any[], status: string) => {
          if (status === "OK" && results && results.length > 0) {
            const result = results[0];
            const components = result.address_components || [];
            let ward = "";
            let locality = "";
            for (const c of components) {
              if (c.types.includes("sublocality_level_1") || c.types.includes("neighborhood")) {
                locality = c.long_name;
              }
              if (c.types.includes("administrative_area_level_4") || c.types.includes("sublocality_level_2")) {
                ward = c.long_name;
              }
            }
            onLocationSelect({
              lat,
              lng,
              address: result.formatted_address || "",
              ward: ward || locality || "",
            });
          } else {
            onLocationSelect({ lat, lng, address: "", ward: "" });
          }
        }
      );
    },
    [onLocationSelect]
  );

  const placeMarker = useCallback(
    (lat: number, lng: number, map: any) => {
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new window.google.maps.Size(40, 40),
          },
        });
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current.getPosition();
          reverseGeocode(pos.lat(), pos.lng());
        });
      }
      map.panTo({ lat, lng });
    },
    [reverseGeocode]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await fetch("/api/maps-key");
        const data = await res.json();
        if (cancelled || !data.key) return;
        setApiKey(data.key);

        await loadGoogleMaps(data.key);
        if (cancelled || !mapContainerRef.current) return;

        const center = initialCoords || defaultCenter;
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: defaultZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });
        mapRef.current = map;

        if (initialCoords) {
          placeMarker(initialCoords.lat, initialCoords.lng, map);
          reverseGeocode(initialCoords.lat, initialCoords.lng);
        }

        map.addListener("click", (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          placeMarker(lat, lng, map);
          reverseGeocode(lat, lng);
        });

        if (searchInputRef.current) {
          const autocomplete = new window.google.maps.places.Autocomplete(
            searchInputRef.current,
            {
              componentRestrictions: { country: "in" },
              fields: ["geometry", "formatted_address", "address_components"],
            }
          );
          autocomplete.bindTo("bounds", map);
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            placeMarker(lat, lng, map);
            map.setZoom(16);

            let ward = "";
            let locality = "";
            for (const c of place.address_components || []) {
              if (
                c.types.includes("sublocality_level_1") ||
                c.types.includes("neighborhood")
              ) {
                locality = c.long_name;
              }
              if (
                c.types.includes("administrative_area_level_4") ||
                c.types.includes("sublocality_level_2")
              ) {
                ward = c.long_name;
              }
            }
            onLocationSelect({
              lat,
              lng,
              address: place.formatted_address || "",
              ward: ward || locality || "",
            });
            setSearchText(place.formatted_address || "");
          });
          autocompleteRef.current = autocomplete;
        }

        setLoading(false);
      } catch (err) {
        console.error("Google Maps init error:", err);
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current) {
          placeMarker(lat, lng, mapRef.current);
          mapRef.current.setZoom(16);
        }
        reverseGeocode(lat, lng);
        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [placeMarker, reverseGeocode]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search location..."
            className="w-full h-12 pl-10 pr-8 text-base rounded-xl border-2 border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-12 px-3 rounded-xl gap-1 text-sm whitespace-nowrap"
          onClick={detectLocation}
          disabled={locating}
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">My Location</span>
        </Button>
      </div>

      <div className="relative rounded-xl overflow-hidden border-2 border-border">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-sm">Loading map...</span>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: "100%", height }} />
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        Tap on the map to pin location, or use search / auto-detect
      </p>
    </div>
  );
}
