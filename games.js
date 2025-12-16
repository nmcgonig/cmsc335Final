const express = require('express')
const router = express.Router()
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({
   path: path.resolve(__dirname, "credentialsDontPost/.env"),
});
const gameSchema = new mongoose.Schema({
        title: String,
        ecoCode: String,
        played: Date,
        URL: String,
        description: String
    });
const Game = mongoose.model("Game", gameSchema, 'finalChessGames');
mongoose.connect(process.env.MONGO_CONNECTION_STRING);


router.get('/new', (req, res) => {
    res.render('gameLog.ejs')
})
router.post('/addGame', async (req, res) => {
    const { title, ecoCode, played, url, description } = req.body;

    
    try {
        const newEntry = new Game({
            title: title,
            ecoCode: ecoCode,
            played: played, 
            URL: url,
            description: description
        });

        await newEntry.save();

        return res.redirect('/'); 

    } catch (error) {        
        let errorMsg = 'Error saving entry.';
        if (error.name === 'ValidationError') {
            errorMsg = Object.values(error.errors).map(val => val.message)[0];
        }

        const msg = encodeURIComponent('Username not found.');
        return res.redirect(`/error?msg=${msg}&status=401`);
    }
});

router.get('/list', async (req,res) => {
    const allEntries = await Game.find({});
    let gameRows = allEntries.reduce((a,c) => a+= `
    
        <tr>
            <td><a href='/game/view/${c._id}'>${c.title}</a></td>
            <td>${c.played}</td>
            
            <td>${c.ecoCode ? c.ecoCode : ''}</td>
        </tr>
    
    `, '')
    res.render('instructionalList.ejs', {rows: gameRows})
})

router.get('/view/:id', async (req, res) => {
    const entryId = req.params.id;

    try {
        const entry = await Game.findById(entryId);

        if (!entry) {
            const msg = encodeURIComponent(`Study with ID ${entryId} not found.`);
            return res.redirect(`/error?msg=${msg}&status=404`);
        }
        res.render('viewGame.ejs', {entry: entry});

    } catch (error) {
        // Handle malformed ID (e.g., non-MongoDB ObjectId format)
        if (error.name === 'CastError') {
             const msg = encodeURIComponent('Invalid study ID format.');
            return res.redirect(`/error?msg=${msg}&status=400`);
        }
        console.error('Error fetching single instructional game:', error);
        const msg = encodeURIComponent('An error occurred while fetching the study details.');
        return res.redirect(`/error?msg=${msg}&status=500`);
    }
});

module.exports = router