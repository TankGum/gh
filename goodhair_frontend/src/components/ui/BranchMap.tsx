'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { PublicBranch } from '@/types/public.type';

interface Props {
  branches: PublicBranch[];
  t: (vi: string, en: string) => string;
}

export default function BranchMap({ branches, t }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import('leaflet').then(() => setLoaded(true));
  }, []);

  const withCoords = branches.filter(b => b.latitude != null && b.longitude != null);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return;
    if (withCoords.length === 0) return;

    (async () => {
      const L = await import('leaflet');

      const icon = L.divIcon({
        className: '',
        html: '<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#EE8A33;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:14px;font-weight:700;color:#0B1620">\u2702</span>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      });

      try {
        const map = L.map(mapRef.current!, {
          zoomControl: true,
          scrollWheelZoom: true,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        const bounds: L.LatLngTuple[] = [];
        withCoords.forEach(b => {
          const latlng: L.LatLngTuple = [b.latitude!, b.longitude!];
          bounds.push(latlng);
          L.marker(latlng, { icon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family:sans-serif;font-size:13px;line-height:1.5">
                <strong style="font-size:15px">${b.name}</strong>
                ${b.address ? `<br><span style="color:#666">${b.address}</span>` : ''}
                ${b.openingTime && b.closingTime ? `<br><span style="color:#999">${b.openingTime.slice(0,5)} \u2013 ${b.closingTime.slice(0,5)}</span>` : ''}
              </div>
            `);
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }

        mapInstance.current = map;
      } catch { /* leaflet error */ }
    })();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [loaded, withCoords]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 480, position: 'relative' }}>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%', minHeight: 480, borderRadius: 3 }}
      />
      {withCoords.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,#0F2233 0%,#0A131D 100%)', borderRadius: 3 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(238,138,51,.3)" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <p style={{ color: 'rgba(241,236,225,.5)', marginTop: 12, fontSize: 14 }}>
            {t('Chưa có toạ độ chi nhánh', 'No branch coordinates yet')}
          </p>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 20px', background: 'linear-gradient(transparent,rgba(8,16,24,.9))', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#EE8A33', fontSize: 13 }}>◉</span>
        <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,.6)', letterSpacing: '.04em' }}>{t('Bản đồ tương tác', 'Interactive map')}</span>
      </div>
    </div>
  );
}
