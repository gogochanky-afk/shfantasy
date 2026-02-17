const express = require('express');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('SH Fantasy Backend Running 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
