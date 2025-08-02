const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/dashboard', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/api/predict');
    res.render('dashboard', { 
      user: req.user, 
      bins: response.data,
      title: 'Dashboard'
    });
  } catch (error) {
    console.error('Error fetching bin data:', error);
    res.render('dashboard', { 
      user: req.user, 
      bins: [],
      error: 'Failed to load bin data'
    });
  }
});

router.get('/map', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/api/predict');
    res.render('map', { 
      user: req.user,
      bins: response.data,
      title: 'Bin Map',
      mapApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
  } catch (error) {
    res.render('map', { 
      user: req.user,
      bins: [],
      error: 'Failed to load map data'
    });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/api/predict');
    const criticalBins = response.data.filter(bin => bin.status === 'critical' || bin.status === 'full');
    res.render('reports', {
      user: req.user,
      criticalBins: criticalBins,
      title: 'Reports'
    });
  } catch (error) {
    res.render('reports', {
      user: req.user,
      criticalBins: [],
      error: 'Failed to load report data'
    });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/api/predict');
    const alertBins = response.data.filter(bin => bin.status === 'critical' || bin.status === 'full');
    res.render('alerts', {
      user: req.user,
      alertBins: alertBins,
      title: 'Alerts'
    });
  } catch (error) {
    res.render('alerts', {
      user: req.user,
      alertBins: [],
      error: 'Failed to load alerts'
    });
  }
});

router.get('/routes', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/api/predict');
    const routeBins = response.data.filter(bin => bin.status === 'critical' || bin.status === 'full');
    res.render('routes', {
      user: req.user,
      routeBins: routeBins,
      title: 'Collection Routes'
    });
  } catch (error) {
    res.render('routes', {
      user: req.user,
      routeBins: [],
      error: 'Failed to load route data'
    });
  }
});

module.exports = router;