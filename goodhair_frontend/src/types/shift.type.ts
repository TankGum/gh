export type ShiftType = 'morning' | 'afternoon' | 'full_day' | 'off';

export interface EmployeeShift {
  employeeId: string;
  date: string;
  shiftType: ShiftType;
}

export interface ShiftBulkUpsertPayload {
  shifts: {
    employeeId: string;
    date: string;
    shiftType: ShiftType;
  }[];
}
