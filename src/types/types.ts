export interface Student {
    id: number;
    student_id: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    address: string;
    email: string;
    gender: string;
    course: string;
    year_level: number;
    section: string;
    profile_image?: string;
}

export interface AttendanceLog {
    id: number;
    student_id: number;
    purpose: string;
    check_in: Date;
    check_out: Date | null;
}

export interface DashboardStats {
    totalVisits: number;
    activeVisitors: number;
    visitsByProgram: {
        program: string;
        count: number;
    }[];
    visitsByPurpose: {
        purpose: string;
        count: number;
    }[];
}

