const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Catch all handler: send back React's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${port}`);
});