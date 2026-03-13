const express = require('express');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
