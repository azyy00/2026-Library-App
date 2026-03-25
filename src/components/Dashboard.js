import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentEditModal from './StudentEditModal';
import StudentProfile from './StudentProfile';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale
} from 'chart.js';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import api, { attendanceApi, buildAssetUrl, statsApi, studentApi } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale
);

const EMPTY_STATS = {
  totalVisits: 0,
  activeVisitors: 0,
  visitsByPurpose: [],
  dailyVisits: [],
  courseDistribution: [],
  monthlyTrends: []
};

const chartPalette = ['#6f1020', '#9b2940', '#c56b7b', '#d4a24c', '#8d6e63', '#dec7a3'];
const YEAR_LEVELS = [1, 2, 3, 4];
const TRACKER_FILTER_DEFAULTS = {
  period: 'today',
  status: 'all'
};
const EMPTY_TRACKER_SUMMARY = {
  todayCheckedOut: 0,
  weekCheckedOut: 0,
  monthCheckedOut: 0,
  pendingCount: 0,
  completedCount: 0
};
const TRACKER_PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Activity' }
];
const TRACKER_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' }
];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseAttendanceDateTime = (value) => {
  if (!value) {
    return null;
  }

  const stringValue = `${value}`.trim();
  const sqlMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (sqlMatch) {
    return {
      year: Number(sqlMatch[1]),
      month: Number(sqlMatch[2]),
      day: Number(sqlMatch[3]),
      hour: Number(sqlMatch[4]),
      minute: Number(sqlMatch[5])
    };
  }

  const parsedDate = new Date(stringValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
    day: parsedDate.getDate(),
    hour: parsedDate.getHours(),
    minute: parsedDate.getMinutes()
  };
};

const formatDateTime = (value, compareValue) => {
  if (!value) {
    return 'Still inside library';
  }

  const parsedValue = parseAttendanceDateTime(value);

  if (!parsedValue) {
    return `${value}`;
  }

  const suffix = parsedValue.hour >= 12 ? 'PM' : 'AM';
  const displayHour = parsedValue.hour % 12 || 12;
  const formattedValue = `${MONTH_LABELS[parsedValue.month - 1]} ${parsedValue.day}, ${parsedValue.year}, ${displayHour}:${`${parsedValue.minute}`.padStart(2, '0')} ${suffix}`;
  const parsedCompareValue = compareValue ? parseAttendanceDateTime(compareValue) : null;

  if (
    parsedCompareValue
    && (
      parsedValue.year !== parsedCompareValue.year
      || parsedValue.month !== parsedCompareValue.month
      || parsedValue.day !== parsedCompareValue.day
    )
  ) {
    return `${formattedValue} (next day)`;
  }

  return formattedValue;
};

const formatDuration = (minutes) => {
  const totalMinutes = Number(minutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return 'N/A';
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
};

const formatExportDateTime = (value) => {
  if (!value) {
    return 'Still inside library';
  }

  const parsedValue = parseAttendanceDateTime(value);

  if (!parsedValue) {
    return `${value}`;
  }

  const month = `${parsedValue.month}`.padStart(2, '0');
  const day = `${parsedValue.day}`.padStart(2, '0');
  const suffix = parsedValue.hour >= 12 ? 'PM' : 'AM';
  const displayHour = parsedValue.hour % 12 || 12;

  return `${month}/${day}/${parsedValue.year} ${displayHour}:${`${parsedValue.minute}`.padStart(2, '0')} ${suffix}`;
};

const formatYearLabel = (yearLevel) => {
  const numericYear = Number(yearLevel);

  if (numericYear === 1) return '1st Year';
  if (numericYear === 2) return '2nd Year';
  if (numericYear === 3) return '3rd Year';
  if (numericYear === 4) return '4th Year';
  return `Year ${yearLevel}`;
};

const buildReportWorksheet = (activities, summaryRows) => {
  const headers = [
    'Student ID',
    'First Name',
    'Last Name',
    'Course',
    'Year Level',
    'Section',
    'Purpose',
    'Time In',
    'Time Out',
    'Status',
    'Duration'
  ];
  const exportRows = activities.map((activity) => ([
    activity.student_id || 'N/A',
    activity.first_name || '',
    activity.last_name || '',
    activity.course || 'N/A',
    activity.year_level ? formatYearLabel(activity.year_level) : 'N/A',
    activity.section || 'N/A',
    activity.purpose || 'N/A',
    formatExportDateTime(activity.check_in),
    formatExportDateTime(activity.check_out),
    activity.status || 'N/A',
    activity.duration_minutes == null ? 'In progress' : formatDuration(activity.duration_minutes)
  ]));
  const rows = [
    ['GCC LIBRARY REPORTS'],
    ['Student attendance activity export'],
    [`Generated ${formatExportDateTime(new Date().toISOString())}`],
    [],
    headers,
    ...exportRows
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const lastColumnIndex = headers.length - 1;

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 }
  ];
  worksheet['!rows'] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 20 }
  ];
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColumnIndex } }
  ];
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 4, c: 0 },
      e: { r: Math.max(exportRows.length + 4, 4), c: lastColumnIndex }
    })
  };

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['GCC LIBRARY REPORTS'],
    ['Summary'],
    [],
    ['Metric', 'Value'],
    ...summaryRows.map((item) => [item.Metric, item.Value])
  ]);

  summarySheet['!cols'] = [{ wch: 24 }, { wch: 28 }];
  summarySheet['!rows'] = [{ hpt: 28 }, { hpt: 20 }];
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }
  ];

  return { worksheet, summarySheet };
};

const drawRoundedRect = (context, x, y, width, height, radius, fillStyle, strokeStyle) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();

  context.fillStyle = fillStyle;
  context.fill();

  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 1;
    context.stroke();
  }
};

function Dashboard() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [managementMessage, setManagementMessage] = useState('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [students, setStudents] = useState([]);
  const [directoryImageErrors, setDirectoryImageErrors] = useState({});
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudentId, setDeletingStudentId] = useState('');
  const [studentFilters, setStudentFilters] = useState({
    query: '',
    course: 'All',
    year: 'All',
    section: 'All',
    sort: 'az'
  });
  const [trackerFilters, setTrackerFilters] = useState(TRACKER_FILTER_DEFAULTS);
  const [trackerSummary, setTrackerSummary] = useState(EMPTY_TRACKER_SUMMARY);
  const [trackerRecords, setTrackerRecords] = useState([]);
  const [isLoadingTracker, setIsLoadingTracker] = useState(true);
  const [trackerMessage, setTrackerMessage] = useState('');

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await statsApi.getOverview();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setIsLoadingStudents(true);
      const response = await studentApi.getAll();
      setStudents(response.data);
      setDirectoryImageErrors({});
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const fetchCheckoutTracker = async (filters = trackerFilters) => {
    try {
      setIsLoadingTracker(true);
      setTrackerMessage('');
      const response = await attendanceApi.getTracker(filters);
      setTrackerSummary(response.data.summary || EMPTY_TRACKER_SUMMARY);
      setTrackerRecords(response.data.records || []);
    } catch (error) {
      console.error('Error fetching tracker:', error);
      setTrackerSummary(EMPTY_TRACKER_SUMMARY);
      setTrackerRecords([]);
      setTrackerMessage(error.response?.data?.error || 'Unable to load the checkout tracker right now.');
    } finally {
      setIsLoadingTracker(false);
    }
  };

  const loadCoreDashboardData = async () => {
    await Promise.all([fetchStats(), fetchStudents()]);
  };

  useEffect(() => {
    loadCoreDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCheckoutTracker(trackerFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerFilters.period, trackerFilters.status]);

  const refreshStudentProfile = async (studentId) => {
    try {
      const response = await studentApi.getProfile(studentId);
      setStudentProfile(response.data);
    } catch (error) {
      console.error('Profile refresh error:', error);

      if (error.response?.status === 404) {
        setStudentProfile(null);
      }
    }
  };

  const openStudentProfile = async (studentId) => {
    try {
      const response = await studentApi.getProfile(studentId);
      setStudentProfile(response.data);
      setSearchMessage('');
    } catch (error) {
      console.error('Profile error:', error);
      setSearchMessage(error.response?.data?.error || 'Student not found.');
    }
  };

  const handleSearch = async () => {
    const query = searchTerm.trim();

    if (!query) {
      setSearchMessage('Enter a student ID before searching.');
      return;
    }

    try {
      setIsSearching(true);
      setSearchMessage('Searching student profile...');
      const response = await studentApi.getProfile(query);
      setStudentProfile(response.data);
      setSearchMessage('');
    } catch (error) {
      console.error('Search error:', error);
      setSearchMessage(error.response?.data?.error || 'Student not found.');
      setStudentProfile(null);
    } finally {
      setIsSearching(false);
    }
  };

  const closeProfile = () => {
    setStudentProfile(null);
    setSearchTerm('');
    setSearchMessage('');
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setManagementMessage('');
  };

  const handleUpdateStudent = async (currentStudentId, submitData) => {
    try {
      setIsSavingStudent(true);
      const response = await studentApi.update(currentStudentId, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const updatedStudent = response.data.student;
      setManagementMessage(`Updated ${updatedStudent.first_name} ${updatedStudent.last_name} successfully.`);
      setEditingStudent(null);

      await Promise.all([fetchStudents(), fetchStats(), fetchCheckoutTracker(trackerFilters)]);

      if (studentProfile?.student?.student_id === currentStudentId) {
        await refreshStudentProfile(updatedStudent.student_id);
      }
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (student) => {
    const studentLabel = `${student.first_name} ${student.last_name}`.trim();
    const confirmed = window.confirm(
      `Delete ${studentLabel} (${student.student_id})?\n\nThis also removes the student's attendance logs.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingStudentId(student.student_id);
      await studentApi.remove(student.student_id);
      setManagementMessage(`Deleted ${studentLabel} successfully.`);

      if (editingStudent?.student_id === student.student_id) {
        setEditingStudent(null);
      }

      if (studentProfile?.student?.student_id === student.student_id) {
        setStudentProfile(null);
      }

      await Promise.all([fetchStudents(), fetchStats(), fetchCheckoutTracker(trackerFilters)]);
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error.response?.data?.error || 'Unable to delete this student right now.';
      setManagementMessage(`Error: ${errorMessage}`);
    } finally {
      setDeletingStudentId('');
    }
  };

  const handleImportStudents = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setIsImporting(true);
    setImportMessage('Processing student import file...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const students = jsonData
        .map((row) => ({
          student_id: row['Student ID'] || row.student_id,
          first_name: row['First Name'] || row.first_name,
          last_name: row['Last Name'] || row.last_name,
          middle_name: row['Middle Name'] || row.middle_name || '',
          address: row.Address || row.address || '',
          email: row.Email || row.email || '',
          gender: row.Gender || row.gender,
          course: row.Course || row.course,
          year_level: row['Year Level'] || row.year_level,
          section: row.Section || row.section
        }))
        .filter((student) => student.student_id && student.first_name && student.last_name);

      if (students.length === 0) {
        setImportMessage('No valid student rows were found in the selected file.');
        return;
      }

      const results = await Promise.allSettled(
        students.map((student) => api.post('/students', student))
      );

      const successfulRows = results.filter((result) => result.status === 'fulfilled').length;
      const failedRows = results.length - successfulRows;

      setImportMessage(
        failedRows > 0
          ? `Imported ${successfulRows} student(s) and skipped ${failedRows} duplicate or invalid row(s).`
          : `Successfully imported ${successfulRows} student(s).`
      );

      if (successfulRows > 0) {
        await Promise.all([fetchStudents(), fetchStats(), fetchCheckoutTracker(trackerFilters)]);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportMessage('Error importing students. Check the Excel headers and try again.');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const exportStudentActivities = async () => {
    try {
      const response = await attendanceApi.exportReport();
      const data = response.data;
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        { Metric: 'Total Visits', Value: data.totalVisits },
        { Metric: 'Active Visitors', Value: data.activeVisitors },
        { Metric: 'Export Date', Value: formatExportDateTime(new Date().toISOString()) }
      ];
      const { worksheet, summarySheet } = buildReportWorksheet(data.activities || [], summaryRows);

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Library Reports');
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      const workbookOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([workbookOutput], { type: 'application/octet-stream' });
      saveAs(blob, `gcc-library-analytics-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      setImportMessage('Error exporting analytics report.');
    }
  };

  const exportCharts = () => {
    try {
      setTimeout(() => {
        const chartPanels = Array.from(document.querySelectorAll('.dashboard-panel'))
          .map((panel) => ({
            title: panel.querySelector('.dashboard-panel-header h3')?.textContent?.trim() || 'Dashboard Chart',
            canvas: panel.querySelector('canvas')
          }))
          .filter((entry) => entry.canvas && entry.canvas.width > 0 && entry.canvas.height > 0);

        if (chartPanels.length === 0) {
          setImportMessage('No charts are available yet. Wait for the dashboard to finish loading.');
          return;
        }

        const combinedCanvas = document.createElement('canvas');
        const context = combinedCanvas.getContext('2d');
        const exportWidth = 980;
        const pagePadding = 30;
        const cardGap = 20;
        const columns = 2;
        const headerHeight = 84;
        const cardWidth = (exportWidth - (pagePadding * 2) - cardGap) / columns;
        const chartAreaHeight = 230;
        const cardHeight = chartAreaHeight + 72;
        const rowCount = Math.ceil(chartPanels.length / columns);
        const totalHeight = headerHeight + pagePadding + (rowCount * cardHeight) + ((rowCount - 1) * cardGap) + pagePadding;

        combinedCanvas.width = exportWidth;
        combinedCanvas.height = totalHeight;

        context.fillStyle = '#f8f4ef';
        context.fillRect(0, 0, exportWidth, totalHeight);
        context.fillStyle = '#6f1020';
        context.font = '700 28px Georgia';
        context.textAlign = 'left';
        context.fillText('GCC Library Dashboard Charts', pagePadding, 40);
        context.fillStyle = '#7b5560';
        context.font = '15px Arial';
        context.fillText(`Exported ${new Date().toLocaleString()}`, pagePadding, 64);

        chartPanels.forEach((entry, index) => {
          const row = Math.floor(index / columns);
          const column = index % columns;
          const cardX = pagePadding + (column * (cardWidth + cardGap));
          const cardY = headerHeight + (row * (cardHeight + cardGap));
          const innerX = cardX + 18;
          const innerY = cardY + 54;
          const innerWidth = cardWidth - 36;
          const innerHeight = chartAreaHeight;
          const scale = Math.min(innerWidth / entry.canvas.width, innerHeight / entry.canvas.height);
          const drawWidth = entry.canvas.width * scale;
          const drawHeight = entry.canvas.height * scale;
          const drawX = innerX + ((innerWidth - drawWidth) / 2);
          const drawY = innerY + ((innerHeight - drawHeight) / 2);

          context.save();
          context.shadowColor = 'rgba(111, 16, 32, 0.12)';
          context.shadowBlur = 16;
          context.shadowOffsetY = 8;
          drawRoundedRect(context, cardX, cardY, cardWidth, cardHeight, 22, '#fffdfb', '#eadbd2');
          context.restore();

          context.fillStyle = '#6f1020';
          context.font = '600 18px Arial';
          context.textAlign = 'left';
          context.fillText(entry.title, cardX + 18, cardY + 34);
          context.drawImage(entry.canvas, drawX, drawY, drawWidth, drawHeight);
        });

        const link = document.createElement('a');
        link.download = `gcc-library-charts-${new Date().toISOString().split('T')[0]}.png`;
        link.href = combinedCanvas.toDataURL('image/png');
        link.click();
      }, 750);
    } catch (error) {
      console.error('Error exporting charts:', error);
      setImportMessage('Error exporting charts. Try again after the page fully loads.');
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Student ID': '2023001',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Middle Name': 'Smith',
        Address: '123 Main St, Goa, Camarines Sur',
        Email: 'john.doe@email.com',
        Gender: 'Male',
        Course: 'BPED',
        'Year Level': 1,
        Section: 'A'
      },
      {
        'Student ID': '2023002',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        'Middle Name': 'Marie',
        Address: '456 Park Ave, Goa, Camarines Sur',
        Email: 'jane.smith@email.com',
        Gender: 'Female',
        Course: 'BECED',
        'Year Level': 2,
        Section: 'B'
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Template');

    const workbookOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([workbookOutput], { type: 'application/octet-stream' });
    saveAs(blob, `gcc-student-import-template-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const purposeData = stats.visitsByPurpose || [];
  const courseData = stats.courseDistribution || [];
  const dailyData = stats.dailyVisits || [];
  const monthlyData = stats.monthlyTrends || [];
  const topPurpose = purposeData[0];
  const topCourse = courseData[0];
  const todayVisits = dailyData[dailyData.length - 1]?.visits || 0;
  const completedVisits = Math.max(stats.totalVisits - stats.activeVisitors, 0);
  const trackerPeriodLabel = TRACKER_PERIOD_OPTIONS.find((option) => option.value === trackerFilters.period)?.label || 'Today';
  const trackerStatusLabel = TRACKER_STATUS_OPTIONS.find((option) => option.value === trackerFilters.status)?.label || 'All';
  const purposeColors = purposeData.map((_, index) => chartPalette[index % chartPalette.length]);
  const courseColors = courseData.map((_, index) => chartPalette[index % chartPalette.length]);
  const allCourses = Array.from(new Set(students.map((student) => student.course).filter(Boolean))).sort();
  const allSections = Array.from(new Set(students.map((student) => student.section).filter(Boolean))).sort();
  const totalPrograms = allCourses.length;
  const studentQuery = studentFilters.query.trim().toLowerCase();
  const filteredStudents = students
    .filter((student) => {
      const matchesQuery =
        !studentQuery ||
        [student.student_id, student.first_name, student.middle_name, student.last_name, student.course]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(studentQuery);

      const matchesCourse = studentFilters.course === 'All' || student.course === studentFilters.course;
      const matchesYear = studentFilters.year === 'All' || String(student.year_level) === studentFilters.year;
      const matchesSection = studentFilters.section === 'All' || student.section === studentFilters.section;

      return matchesQuery && matchesCourse && matchesYear && matchesSection;
    })
    .sort((left, right) => {
      if (studentFilters.sort === 'za') {
        return `${right.last_name} ${right.first_name}`.localeCompare(`${left.last_name} ${left.first_name}`);
      }

      return `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`);
    });
  const programYearLabels = allCourses;
  const programYearDatasets = YEAR_LEVELS.map((yearLevel, index) => ({
    label: formatYearLabel(yearLevel),
    data: programYearLabels.map((course) =>
      students.filter(
        (student) => student.course === course && Number(student.year_level) === yearLevel
      ).length
    ),
    backgroundColor: chartPalette[index % chartPalette.length],
    borderRadius: 8,
    maxBarThickness: 44
  }));

  let runningTotal = 0;
  const cumulativeDailyVisits = dailyData.map((item) => {
    runningTotal += Number(item.visits) || 0;
    return runningTotal;
  });

  const purposeRatioChart = {
    labels: purposeData.map((item) => item.purpose),
    datasets: [
      {
        data: purposeData.map((item) => item.count),
        backgroundColor: purposeColors,
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  const courseRatioChart = {
    labels: courseData.map((item) => item.course),
    datasets: [
      {
        data: courseData.map((item) => item.count),
        backgroundColor: courseColors,
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  const visitorStatusChart = {
    labels: ['Completed Visits', 'Active Visitors'],
    datasets: [
      {
        data: [completedVisits, stats.activeVisitors],
        backgroundColor: ['#c56b7b', '#6f1020'],
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  const radarChart = {
    labels: courseData.map((item) => item.course),
    datasets: [
      {
        label: 'Students',
        data: courseData.map((item) => item.count),
        borderColor: '#6f1020',
        backgroundColor: 'rgba(111, 16, 32, 0.18)',
        pointBackgroundColor: '#6f1020',
        pointBorderColor: '#ffffff'
      }
    ]
  };

  const performanceChart = {
    labels: dailyData.map((item) => item.date),
    datasets: [
      {
        label: 'Daily Visits',
        data: dailyData.map((item) => item.visits),
        borderColor: '#6f1020',
        backgroundColor: 'rgba(111, 16, 32, 0.12)',
        yAxisID: 'y',
        fill: false,
        tension: 0.35
      },
      {
        label: 'Running Total',
        data: cumulativeDailyVisits,
        borderColor: '#d4a24c',
        backgroundColor: 'rgba(212, 162, 76, 0.16)',
        yAxisID: 'y1',
        fill: false,
        tension: 0.35
      }
    ]
  };

  const sharedDoughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '52%',
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        grid: {
          color: 'rgba(111, 16, 32, 0.18)'
        },
        angleLines: {
          color: 'rgba(111, 16, 32, 0.12)'
        }
      }
    }
  };

  const performanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        position: 'left',
        ticks: {
          precision: 0
        }
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          precision: 0
        }
      }
    }
  };

  const programMatrixOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="dashboard-shell">
      {searchMessage && (
        <div className={`alert ${searchMessage.includes('not found') ? 'alert-warning' : 'alert-info'} mb-3`}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{searchMessage}</span>
            {searchMessage.includes('not found') && (
              <Link to="/register" className="btn btn-outline-maroon btn-sm">
                Register student
              </Link>
            )}
          </div>
        </div>
      )}

      {importMessage && (
        <div className={`alert ${importMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mb-3`}>
          {importMessage}
        </div>
      )}

      {managementMessage && (
        <div className={`alert ${managementMessage.includes('Error:') ? 'alert-danger' : 'alert-success'} mb-3`}>
          {managementMessage}
        </div>
      )}

      {trackerMessage && (
        <div className="alert alert-warning mb-3">
          {trackerMessage}
        </div>
      )}

      <section className="dashboard-command-bar">
        <div className="dashboard-command-copy">
          <p className="dashboard-kicker">Library Control Center</p>
          <h2>Attendance Overview</h2>
          <p className="mb-0">
            This dashboard keeps student attendance, visit purpose trends, and registration tools in the same workspace.
          </p>

          <div className="dashboard-mini-stats">
            <div className="dashboard-mini-stat">
              <span>Total visits</span>
              <strong>{isLoadingStats ? '...' : stats.totalVisits}</strong>
            </div>
            <div className="dashboard-mini-stat">
              <span>Active visitors</span>
              <strong>{isLoadingStats ? '...' : stats.activeVisitors}</strong>
            </div>
            <div className="dashboard-mini-stat">
              <span>Today&apos;s visits</span>
              <strong>{todayVisits}</strong>
            </div>
            <div className="dashboard-mini-stat">
              <span>Programs tracked</span>
              <strong>{totalPrograms}</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-command-actions">
          <div className="dashboard-search-card">
            <label className="form-label">Student profile lookup</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Search by student ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              />
              <button
                type="button"
                className="btn btn-maroon"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="dashboard-tool-grid">
            <label className="dashboard-upload-tile">
              <span>Import students</span>
              <small>{isImporting ? 'Uploading...' : 'Excel file'}</small>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportStudents}
                disabled={isImporting}
              />
            </label>

            <button type="button" className="dashboard-tool-tile" onClick={downloadTemplate}>
              <span>Download template</span>
              <small>Starter import sheet</small>
            </button>

            <button type="button" className="dashboard-tool-tile" onClick={exportStudentActivities}>
              <span>Export report</span>
              <small>Excel analytics</small>
            </button>

            <button type="button" className="dashboard-tool-tile" onClick={exportCharts}>
              <span>Export charts</span>
              <small>Image snapshot</small>
            </button>

            <Link to="/attendance" className="dashboard-tool-tile dashboard-tool-link">
              <span>Attendance desk</span>
              <small>Open check-in workspace</small>
            </Link>

            <Link to="/monitoring" className="dashboard-tool-tile dashboard-tool-link">
              <span>Monitoring kiosk</span>
              <small>Open student ID scan screen</small>
            </Link>

            <Link to="/active" className="dashboard-tool-tile dashboard-tool-link">
              <span>Active visitors</span>
              <small>Review open records</small>
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-tracker-panel">
        <div className="dashboard-panel-header dashboard-panel-header-spread">
          <div>
            <h3>Check-Out Tracker</h3>
            <p className="dashboard-subcopy mb-0">
              Track students who have completed check-out today, this week, this month, or are still pending inside the library.
            </p>
          </div>
          <div className="dashboard-directory-summary">
            <span>Records shown</span>
            <strong>{isLoadingTracker ? '...' : trackerRecords.length}</strong>
          </div>
        </div>

        <div className="dashboard-tracker-toolbar">
          <div className="dashboard-filter-cluster">
            <span className="dashboard-filter-label">Period</span>
            <div className="dashboard-filter-chips">
              {TRACKER_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`dashboard-filter-chip${trackerFilters.period === option.value ? ' active' : ''}`}
                  onClick={() => setTrackerFilters((current) => ({ ...current, period: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-filter-cluster">
            <span className="dashboard-filter-label">Status</span>
            <div className="dashboard-filter-chips">
              {TRACKER_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`dashboard-filter-chip${trackerFilters.status === option.value ? ' active' : ''}`}
                  onClick={() => setTrackerFilters((current) => ({ ...current, status: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-tracker-summary-grid">
          <div className="metric-slab dashboard-tracker-slab">
            <span>Checked Out Today</span>
            <strong>{isLoadingTracker ? '...' : trackerSummary.todayCheckedOut}</strong>
            <small>Completed attendance records closed today.</small>
          </div>
          <div className="metric-slab dashboard-tracker-slab">
            <span>Checked Out This Week</span>
            <strong>{isLoadingTracker ? '...' : trackerSummary.weekCheckedOut}</strong>
            <small>Completed records closed during the current week.</small>
          </div>
          <div className="metric-slab dashboard-tracker-slab">
            <span>Checked Out This Month</span>
            <strong>{isLoadingTracker ? '...' : trackerSummary.monthCheckedOut}</strong>
            <small>Completed records closed during the current month.</small>
          </div>
          <div className="metric-slab dashboard-tracker-slab">
            <span>Pending Now</span>
            <strong>{isLoadingTracker ? '...' : trackerSummary.pendingCount}</strong>
            <small>Students who are still inside the library right now.</small>
          </div>
          <div className="metric-slab dashboard-tracker-slab">
            <span>Completed Total</span>
            <strong>{isLoadingTracker ? '...' : trackerSummary.completedCount}</strong>
            <small>Attendance sessions that already reached check-out.</small>
          </div>
        </div>

        <div className="dashboard-tracker-note">
          <div>
            <strong>{trackerPeriodLabel} / {trackerStatusLabel}</strong>
            <small>Times follow the recorded attendance transaction time. Check-in stays on the student's time in, and check-out stays on the student's actual time out.</small>
          </div>
        </div>

        <div className="table-responsive dashboard-tracker-table-wrap">
          {isLoadingTracker ? (
            <p className="dashboard-empty-copy">Loading checkout tracker...</p>
          ) : trackerRecords.length > 0 ? (
            <table className="table align-middle dashboard-table mb-0">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Purpose</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {trackerRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="dashboard-tracker-student">
                        <strong>{`${record.first_name} ${record.last_name}`}</strong>
                        <small>{record.student_id}</small>
                      </div>
                    </td>
                    <td>{`${record.course || 'N/A'} / ${record.year_level ? formatYearLabel(record.year_level) : 'Year N/A'} / ${record.section ? `Section ${record.section}` : 'Section N/A'}`}</td>
                    <td>{record.purpose}</td>
                    <td>{formatDateTime(record.check_in)}</td>
                    <td>{formatDateTime(record.check_out, record.check_in)}</td>
                    <td>
                      <span className={`status-pill ${record.status === 'Completed' ? 'status-complete' : 'status-pending'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>{`${formatDuration(record.duration_minutes)}${record.status === 'Pending' ? ' elapsed' : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dashboard-empty-copy">No student records match the current checkout tracker filters.</p>
          )}
        </div>
      </section>

      <section className="dashboard-card-grid dashboard-top-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Visit Purpose Ratio</h3>
          </div>
          <div className="dashboard-chart-wrap chart-compact">
            {purposeData.length > 0 ? (
              <Doughnut data={purposeRatioChart} options={sharedDoughnutOptions} />
            ) : (
              <p className="dashboard-empty-copy">Purpose ratio will appear once attendance logs are recorded.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Program Distribution</h3>
          </div>
          <div className="dashboard-chart-wrap chart-compact">
            {courseData.length > 0 ? (
              <Doughnut data={courseRatioChart} options={sharedDoughnutOptions} />
            ) : (
              <p className="dashboard-empty-copy">Program distribution is shown after students are registered.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Visitor Status Ratio</h3>
          </div>
          <div className="dashboard-chart-wrap chart-compact">
            {stats.totalVisits > 0 ? (
              <Doughnut data={visitorStatusChart} options={sharedDoughnutOptions} />
            ) : (
              <p className="dashboard-empty-copy">Visitor status will appear after the first check-in is logged.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Program Reach Radar</h3>
          </div>
          <div className="dashboard-chart-wrap chart-compact">
            {courseData.length > 0 ? (
              <Radar data={radarChart} options={radarOptions} />
            ) : (
              <p className="dashboard-empty-copy">Program radar will appear after students are registered.</p>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-card-grid dashboard-bottom-grid">
        <article className="dashboard-panel dashboard-panel-large">
          <div className="dashboard-panel-header">
            <h3>Attendance Performance Overview</h3>
          </div>
          <div className="dashboard-chart-wrap chart-tall">
            {dailyData.length > 0 ? (
              <Line data={performanceChart} options={performanceOptions} />
            ) : (
              <p className="dashboard-empty-copy">Daily attendance performance will appear after visits are logged.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel-large">
          <div className="dashboard-panel-header dashboard-panel-header-spread">
            <h3>Program Year Matrix</h3>
            <select className="dashboard-year-select" defaultValue="current">
              <option value="current">Current Records</option>
              <option value="last-six-months">Last 6 Months</option>
            </select>
          </div>
          <div className="dashboard-chart-wrap chart-tall">
            {programYearLabels.length > 0 ? (
              <Bar
                data={{
                  labels: programYearLabels,
                  datasets: programYearDatasets
                }}
                options={programMatrixOptions}
              />
            ) : (
              <p className="dashboard-empty-copy">Program year distribution will appear after student registration.</p>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-card-grid dashboard-bottom-grid dashboard-bottom-grid-secondary">
        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Purpose Breakdown</h3>
          </div>
          {purposeData.length > 0 ? (
            <div className="table-responsive">
              <table className="table align-middle dashboard-table mb-0">
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Count</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {purposeData.map((item) => (
                    <tr key={item.purpose}>
                      <td>{item.purpose}</td>
                      <td>{item.count}</td>
                      <td>{stats.totalVisits ? `${((item.count / stats.totalVisits) * 100).toFixed(1)}%` : '0%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty-copy">Detailed purpose statistics will appear after the first attendance entries.</p>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Operations Notes</h3>
          </div>
          <div className="dashboard-note-list">
            <div>
              <span>Top purpose</span>
              <strong>{topPurpose ? `${topPurpose.purpose} (${topPurpose.count})` : 'No attendance data yet'}</strong>
            </div>
            <div>
              <span>Strongest program</span>
              <strong>{topCourse ? `${topCourse.course} (${topCourse.count})` : 'No program data yet'}</strong>
            </div>
            <div>
              <span>Total students</span>
              <strong>{students.length}</strong>
            </div>
            <div>
              <span>Tracked months</span>
              <strong>{monthlyData.length}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header dashboard-panel-header-spread">
          <div>
            <h3>All Students Directory</h3>
            <p className="dashboard-subcopy mb-0">
              View every student record and filter by program, year, section, or alphabetical order.
            </p>
          </div>
          <div className="dashboard-directory-summary">
            <span>{filteredStudents.length} shown</span>
            <strong>{students.length} total</strong>
          </div>
        </div>

        <div className="dashboard-directory-controls">
          <input
            type="text"
            className="form-control"
            placeholder="Filter by name, student ID, or program"
            value={studentFilters.query}
            onChange={(event) => setStudentFilters((current) => ({ ...current, query: event.target.value }))}
          />

          <select
            className="form-select"
            value={studentFilters.course}
            onChange={(event) => setStudentFilters((current) => ({ ...current, course: event.target.value }))}
          >
            <option value="All">All programs</option>
            {allCourses.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={studentFilters.year}
            onChange={(event) => setStudentFilters((current) => ({ ...current, year: event.target.value }))}
          >
            <option value="All">All years</option>
            {YEAR_LEVELS.map((yearLevel) => (
              <option key={yearLevel} value={yearLevel}>
                {formatYearLabel(yearLevel)}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={studentFilters.section}
            onChange={(event) => setStudentFilters((current) => ({ ...current, section: event.target.value }))}
          >
            <option value="All">All sections</option>
            {allSections.map((section) => (
              <option key={section} value={section}>
                Section {section}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={studentFilters.sort}
            onChange={(event) => setStudentFilters((current) => ({ ...current, sort: event.target.value }))}
          >
            <option value="az">A to Z</option>
            <option value="za">Z to A</option>
          </select>
        </div>

        <div className="table-responsive dashboard-directory-table-wrap">
          <table className="table align-middle dashboard-table mb-0">
            <thead>
              <tr>
                <th>Student</th>
                <th>Program</th>
                <th>Year</th>
                <th>Section</th>
                <th>Email</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.student_id}>
                    <td>
                      <div className="dashboard-student-cell">
                        <div className="dashboard-student-avatar">
                          {student.profile_image && !directoryImageErrors[student.student_id] ? (
                            <img
                              src={buildAssetUrl(student.profile_image)}
                              alt={`${student.first_name} ${student.last_name}`}
                              onError={() =>
                                setDirectoryImageErrors((current) => ({
                                  ...current,
                                  [student.student_id]: true
                                }))
                              }
                            />
                          ) : (
                            <span>{student.first_name?.[0] || 'S'}{student.last_name?.[0] || 'T'}</span>
                          )}
                        </div>
                        <div>
                          <strong>{[student.last_name, student.first_name].filter(Boolean).join(', ')}</strong>
                          <small>{student.student_id}</small>
                        </div>
                      </div>
                    </td>
                    <td>{student.course}</td>
                    <td>{formatYearLabel(student.year_level)}</td>
                    <td>{student.section || 'N/A'}</td>
                    <td>{student.email || 'N/A'}</td>
                    <td className="text-end">
                      <div className="dashboard-row-actions">
                        <button
                          type="button"
                          className="btn btn-outline-maroon btn-sm"
                          onClick={() => openStudentProfile(student.student_id)}
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => handleEditStudent(student)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteStudent(student)}
                          disabled={deletingStudentId === student.student_id}
                        >
                          {deletingStudentId === student.student_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    {isLoadingStudents ? 'Loading student records...' : 'No students matched the selected filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {studentProfile && (
        <StudentProfile
          studentData={studentProfile}
          onClose={closeProfile}
          onEditStudent={handleEditStudent}
          onDeleteStudent={handleDeleteStudent}
          isDeletingStudent={deletingStudentId === studentProfile.student.student_id}
        />
      )}

      {editingStudent && (
        <StudentEditModal
          student={editingStudent}
          isSaving={isSavingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={handleUpdateStudent}
        />
      )}
    </div>
  );
}

export default Dashboard;
