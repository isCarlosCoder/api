const express = require('express');
const router = express.Router();
const path = require('path');
const { tiktokStalk } = require('./func/functions');

router.get('/', async (req, res) => {
  const texto = req.query.username; 
  try {
    if (!texto) {
      const errorResponse = {
        status: false,
        message: 'Você deve especificar o nome de um nome de usuário do Tiktok.'
      };
      const formattedResults_e = JSON.stringify(errorResponse, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.send(formattedResults_e);
      return;
    }        
    const igStalkss = await tiktokStalk(texto);
    const formattedResults = JSON.stringify(igStalkss, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.send(formattedResults);
  } catch (error) {
    res.sendFile(path.join(__dirname, '../public/500.html'));
  }
});

module.exports = router;
