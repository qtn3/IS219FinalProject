const express = require('express');
const mysql = require('../config/db.config');

const router = express.Router();

router.post('/delete/:id', (req, res) => {
    const sql = 'DELETE FROM tblCitiesImport WHERE id=?';
    mysql.query(sql, req.params.id, (err) => {
        if (err) throw err;
        res.render('../views/deletesuccess');
    });
});

module.exports = router;
