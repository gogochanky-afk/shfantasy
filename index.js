const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

// API route example
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// serve frontend if exists
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
