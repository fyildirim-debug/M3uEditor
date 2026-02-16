require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M3U Playlist Editor API running on port ${PORT}`);
});
