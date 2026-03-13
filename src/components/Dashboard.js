import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

const formatYearLabel = (yearLevel) => {
  const numericYear = Number(yearLevel);

  if (numericYear === 1) return '1st Year';
  if (numericYear === 2) return '2nd Year';
  if (numericYear === 3) return '3rd Year';
  if (numericYear === 4) return '4th Year';
  return `Year ${yearLevel}`;
};

function Dashboard() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [students, setStudents] = useState([]);
  const [directoryImageErrors, setDirectoryImageErrors] = useState({});
  const [studentFilters, setStudentFilters] = useState({
    query: '',
    course: 'All',
    year: 'All',
    section: 'All',
    sort: 'az'
  });

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

  const loadDashboardData = async () => {
    await Promise.all([fetchStats(), fetchStudents()]);
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        loadDashboardData();
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

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.activities), 'Student Activities');
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet([
          { Metric: 'Total Visits', Value: data.totalVisits },
          { Metric: 'Active Visitors', Value: data.activeVisitors },
          { Metric: 'Export Date', Value: new Date().toLocaleString() }
        ]),
        'Statistics'
      );

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
        const chartCanvases = document.querySelectorAll('canvas');

        if (chartCanvases.length === 0) {
          setImportMessage('No charts are available yet. Wait for the dashboard to finish loading.');
          return;
        }

        const combinedCanvas = document.createElement('canvas');
        const context = combinedCanvas.getContext('2d');
        const chartWidth = 1280;
        const chartHeight = 420;
        const spacing = 26;
        const totalHeight = 90 + chartCanvases.length * (chartHeight + spacing);

        combinedCanvas.width = chartWidth;
        combinedCanvas.height = totalHeight;

        context.fillStyle = '#f6f7fb';
        context.fillRect(0, 0, chartWidth, totalHeight);
        context.fillStyle = '#111827';
        context.font = 'bold 28px Arial';
        context.textAlign = 'center';
        context.fillText('Goa Community College Library Dashboard', chartWidth / 2, 40);
        context.font = '16px Arial';
        context.fillText(`Exported ${new Date().toLocaleString()}`, chartWidth / 2, 66);

        chartCanvases.forEach((canvas, index) => {
          const offsetY = 90 + index * (chartHeight + spacing);
          context.drawImage(canvas, 0, offsetY, chartWidth, chartHeight);
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

            <Link to="/active" className="dashboard-tool-tile dashboard-tool-link">
              <span>Active visitors</span>
              <small>Review open records</small>
            </Link>
          </div>
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
                      <button
                        type="button"
                        className="btn btn-outline-maroon btn-sm"
                        onClick={() => openStudentProfile(student.student_id)}
                      >
                        View profile
                      </button>
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

      {studentProfile && <StudentProfile studentData={studentProfile} onClose={closeProfile} />}
    </div>
  );
}

export default Dashboard;
