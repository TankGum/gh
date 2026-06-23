import type { Metadata } from 'next';
import AuditLogClient from './AuditLogClient';

export const metadata: Metadata = { title: 'Nhật ký hoạt động | GoodHair' };

export default function AuditLogPage() {
  return (
    <div style={{ padding: 28 }}>
      <AuditLogClient />
    </div>
  );
}
