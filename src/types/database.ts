export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'admin' | 'employee';
  hourly_wage: number;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  link?: string;
  created_at: string;
}

/* export interface AttendanceRecord {
  id: string;
  profile_id: string;
  location_id: string;
  check_in: string;
  check_out?: string;
  task?: string;
  comments?: string;
  created_at: string;
} */
  export interface AttendanceRecord {
    id: string;
    profile_id: string;
    location_id: string;
    check_in: string;
    check_out: string | null;
    task: string | null;
    comments: string | null;
    created_at: string;
  
    // Add these if you do sub-selects
    profiles?: {
      first_name: string;
      last_name: string;
    };
    locations?: {
      name: string;
    };
  }
  