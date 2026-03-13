const mysql = require('mysql2');

// Create connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'library_attendance'
});

// Test connection
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Successfully connected to database!');

  // Test inserting a student
  const testStudent = {
    student_id: 'TEST001',
    name: 'Test Student',
    program: 'BSIT',
    course: 'Information Technology',
    year_level: 1
  };

  connection.query('INSERT INTO students SET ?', testStudent, (error, results) => {
    if (error) {
      console.error('Error inserting test data:', error);
      return;
    }
    console.log('Test student inserted successfully!');

    // Test selecting the inserted student
    connection.query('SELECT * FROM students WHERE student_id = ?', ['TEST001'], (error, results) => {
      if (error) {
        console.error('Error selecting test data:', error);
        return;
      }
      console.log('Test student retrieved successfully:', results);

      // Clean up test data
      connection.query('DELETE FROM students WHERE student_id = ?', ['TEST001'], (error) => {
        if (error) {
          console.error('Error cleaning test data:', error);
          return;
        }
        console.log('Test data cleaned up successfully!');
        connection.end();
      });
    });
  });
});
