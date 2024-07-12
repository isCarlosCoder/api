const express = require('express');
const router = express.Router();
const path = require('path');
const { downloadTwitterMedia } = require('./func/functions');

router.get('/', async (req, res) => {
  const url = req.query.url; 
  try {
    if (!url) {
      const errorResponse = {
        status: false,
        message: 'Você deve inserir o link de um vídeo ou imagem do X (Twitter).'
      };
      const formattedResults_e = JSON.stringify(errorResponse, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.send(formattedResults_e);
      return;
    }        
    const pint = await downloadTwitterMedia(url);
    const formattedResults = JSON.stringify(pint, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.send(formattedResults);
  } catch (error) {
    res.sendFile(path.join(__dirname, '../public/500.html'));
  }
});

module.exports = router;
