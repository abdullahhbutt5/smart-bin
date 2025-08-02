const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

let binStatus = {};
const STATUS_FILE = path.join(__dirname, '../bin_status.json');

try {
  binStatus = JSON.parse(fs.readFileSync(STATUS_FILE));
} catch (e) {
  binStatus = {};
}

router.get('/predict', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5001/predict');
    const data = response.data.map(bin => ({
      ...bin,
      lastUpdated: new Date().toISOString(),
      status: binStatus[bin.bin_id]?.status || 
             (bin.predicted_fill >= 100 ? 'full' : 
              bin.predicted_fill >= 80 ? 'critical' : 
              bin.insufficient_data ? 'no-data' : 'normal'),
      collected: binStatus[bin.bin_id]?.collected || false
    }));
    res.json(data);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction service unavailable' });
  }
});

router.post('/update-bin', (req, res) => {
  const { binId, action } = req.body;
  
  if (!binStatus[binId]) binStatus[binId] = {};
  
  if (action === 'collect') {
    binStatus[binId].collected = true;
    binStatus[binId].collectedAt = new Date().toISOString();
  } else if (action === 'schedule') {
    binStatus[binId].scheduled = true;
    binStatus[binId].scheduledAt = new Date().toISOString();
  }
  
  fs.writeFileSync(STATUS_FILE, JSON.stringify(binStatus));
  
  res.json({ success: true });
});

router.get('/updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendUpdate = () => {
    const timestamp = new Date().toISOString();
    res.write(`data: ${JSON.stringify({ timestamp })}\n\n`);
  };
  
  const interval = setInterval(sendUpdate, 30000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = router;