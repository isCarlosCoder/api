const express = require('express');
const router = express.Router();
const path = require('path'); 

router.get('/', async (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'docs.html');
    res.sendFile(indexPath);
});

module.exports = router;
