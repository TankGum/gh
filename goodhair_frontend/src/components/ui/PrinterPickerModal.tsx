'use client';

import { useState, useEffect } from 'react';
import { Printer, Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { listPrinters, getSavedPrinter, savePrinter } from '@/services/printing';

export default function PrinterPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(getSavedPrinter());
    setError(null);
    setLoading(true);
    listPrinters()
      .then(setPrinters)
      .catch(e => setError(e instanceof Error ? e.message : 'Không tải được danh sách máy in'))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePick = (name: string) => {
    savePrinter(name);
    setSelected(name);
  };

  return (
    <Modal open={open} onClose={onClose} title="Cấu hình máy in hoá đơn">
      <div style={{ padding: '4px 0' }}>
        <p style={{ fontSize: 12.5, color: 'rgba(241,236,225,.5)', marginBottom: 16, lineHeight: 1.6 }}>
          Chọn máy in nhiệt để in hoá đơn tự động khi hoàn thành lịch hẹn. Cần đã cài & mở{' '}
          <b style={{ color: '#F1ECE1' }}>QZ Tray</b> trên máy tính này.
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(241,236,225,.5)', fontSize: 13 }}>
            Đang tìm máy in...
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 12.5, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!loading && !error && printers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(241,236,225,.4)', fontSize: 13 }}>
            Không tìm thấy máy in nào trong QZ Tray.
          </div>
        )}

        {!loading && printers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {printers.map(name => {
              const isSelected = selected === name;
              return (
                <button
                  key={name}
                  onClick={() => handlePick(name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 6,
                    border: isSelected ? '1px solid rgba(238,138,51,.5)' : '1px solid rgba(238,138,51,.12)',
                    background: isSelected ? 'rgba(238,138,51,.1)' : 'transparent',
                    color: '#F1ECE1', fontSize: 13, cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <Printer size={15} color={isSelected ? '#EE8A33' : 'rgba(241,236,225,.5)'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  {isSelected && <Check size={15} color="#EE8A33" style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ background: '#EE8A33', color: '#0B1620', border: 'none', padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Xong
          </button>
        </div>
      </div>
    </Modal>
  );
}
