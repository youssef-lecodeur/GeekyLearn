const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 3000;
const saltRounds = 10;

// Multer pour photo de profil
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// Multer pour CV PDF
const cvStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/cv/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
const uploadCV = multer({ 
    storage: cvStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Seuls les fichiers PDF sont acceptés !'));
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialisation de la base de données
const db = new sqlite3.Database('./geekylearn.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the geekylearn database.');
});

// Création des tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        nom TEXT,
        prenom TEXT,
        role TEXT DEFAULT 'apprenant',
        profile_pic_path TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS formateur_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        cv_path TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS formations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        description TEXT,
        prix REAL,
        formateur_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(formateur_id) REFERENCES users(id)
    )`);
});

// Inscription
app.post('/register', upload.single('profilePic'), (req, res) => {
    const { username, password, nom, prenom, role } = req.body;
    const profilePicPath = req.file ? req.file.path : 'plavatar.png';
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ success: false, message: "Erreur de hachage." });
        const sql = 'INSERT INTO users (username, password, nom, prenom, role, profile_pic_path) VALUES (?, ?, ?, ?, ?, ?)';
        db.run(sql, [username, hash, nom, prenom, role || 'apprenant', profilePicPath], function(err) {
            if (err) return res.status(400).json({ success: false, message: "Nom d'utilisateur déjà pris." });
            res.json({ success: true, userId: this.lastID, message: "Inscription réussie !" });
        });
    });
});

// Candidature formateur (upload CV)
app.post('/apply-formateur', uploadCV.single('cv'), (req, res) => {
    const { userId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "CV requis (PDF)." });
    const cvPath = req.file.path;
    db.run('INSERT INTO formateur_applications (user_id, cv_path) VALUES (?, ?)', [userId, cvPath], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Erreur lors de la candidature." });
        res.json({ success: true, message: "Candidature envoyée." });
    });
});

// Connexion
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) return res.status(400).json({ success: false, message: "Identifiants incorrects." });
        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({ 
                    success: true, 
                    user: { 
                        id: user.id,
                        nom: user.nom, 
                        prenom: user.prenom,
                        role: user.role,
                        profilePicPath: user.profile_pic_path 
                    } 
                });
            } else {
                res.status(400).json({ success: false, message: "Identifiants incorrects." });
            }
        });
    });
});

// Modifier le profil
app.post('/update-profile', upload.single('profilePic'), (req, res) => {
    const { username, prenom, nom } = req.body;
    let profilePicPath = req.body.oldProfilePicPath || 'plavatar.png';
    if (req.file) profilePicPath = req.file.path;
    const sql = 'UPDATE users SET prenom = ?, nom = ?, profile_pic_path = ? WHERE username = ?';
    db.run(sql, [prenom, nom, profilePicPath, username], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour." });
        res.json({ success: true, message: "Profil mis à jour.", profilePicPath });
    });
});

// Liste des candidatures formateur (admin)
app.get('/admin/candidatures', (req, res) => {
    db.all(`SELECT fa.id, u.username, u.nom, u.prenom, fa.cv_path, fa.status 
            FROM formateur_applications fa 
            JOIN users u ON fa.user_id = u.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, candidatures: rows });
    });
});

// Accepter une candidature (admin)
app.post('/admin/accept-candidature', (req, res) => {
    const { candidatureId } = req.body;
    db.get('SELECT user_id FROM formateur_applications WHERE id = ?', [candidatureId], (err, row) => {
        if (err || !row) return res.status(400).json({ success: false });
        db.run('UPDATE users SET role = ? WHERE id = ?', ['formateur', row.user_id], (err2) => {
            if (err2) return res.status(500).json({ success: false });
            db.run('UPDATE formateur_applications SET status = ? WHERE id = ?', ['accepted', candidatureId]);
            res.json({ success: true });
        });
    });
});

// Refuser une candidature (admin)
app.post('/admin/reject-candidature', (req, res) => {
    const { candidatureId } = req.body;
    db.run('UPDATE formateur_applications SET status = ? WHERE id = ?', ['rejected', candidatureId], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Créer une formation (formateur)
app.post('/formations', (req, res) => {
    const { titre, description, prix, formateur_id } = req.body;
    db.run('INSERT INTO formations (titre, description, prix, formateur_id) VALUES (?, ?, ?, ?)', 
        [titre, description, prix, formateur_id], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, formationId: this.lastID });
    });
});

// Lister les formations
app.get('/formations', (req, res) => {
    db.all('SELECT f.*, u.username AS formateur FROM formations f JOIN users u ON f.formateur_id = u.id', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, formations: rows });
    });
});

// Supprimer une formation (formateur ou admin)
app.post('/formations/delete', (req, res) => {
    const { formationId, userId, isAdmin } = req.body;
    const sql = isAdmin ? 'DELETE FROM formations WHERE id = ?' : 'DELETE FROM formations WHERE id = ? AND formateur_id = ?';
    const params = isAdmin ? [formationId] : [formationId, userId];
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});