const express = require('express');
const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('Blog Site Backend !');
}
);

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
}
);

