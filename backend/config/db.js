const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'library_attendance'
});

// Test connection immediately
connection.connect(err => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1); // Exit if can't connect to database
    }
    console.log('Connected to database successfully');
});

module.exports = connection;
