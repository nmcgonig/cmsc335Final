const express = require('express')
const router = express.Router()

async function getRecentGames(username) {
    const archivesUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
    const archivesResponse = await fetch(archivesUrl);
    
    if (!archivesResponse.ok) {
        throw new Error(`Failed to fetch archives list: ${archivesResponse.status}`);
    }
    
    const archivesData = await archivesResponse.json();
    
    if (!archivesData.archives || archivesData.archives.length === 0) {
        throw new Error('No game archives found for this player.');
    }
    
    const latestArchiveUrl = archivesData.archives.pop();
    
    const gamesResponse = await fetch(latestArchiveUrl);
    
    if (!gamesResponse.ok) {
        throw new Error(`Failed to fetch games from archive: ${gamesResponse.status}`);
    }
    
    const gamesData = await gamesResponse.json();
    
    const games = gamesData.games;
    
    const recentGames = games
        .sort((a, b) => b.end_time - a.end_time)
        .slice(0, 10)
        .map(game => {
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
            const player = isWhite ? game.white : game.black;
            const opponent = isWhite ? game.black : game.white;

            return {
                whiteName: game.white.username.toLowerCase(),
                blackName: game.black.username.toLowerCase(),
                result: player.result,
                gameUrl: game.url,
                timeClass: game.time_class.toUpperCase(),
                date: new Date(game.end_time * 1000).toLocaleDateString()
            };
        });

    return { games: recentGames, success: true };
}

async function analyzeOpenings(targetUsername, targetColor) {
    const MIN_GAMES_THRESHOLD = 5;

    const archivesUrl = `https://api.chess.com/pub/player/${targetUsername}/games/archives`;
    let archivesResponse;
    try {
        archivesResponse = await fetch(archivesUrl);
        if (!archivesResponse.ok) {
            throw new Error(`Failed to fetch archives. Status: ${archivesResponse.status}`);
        }
        const archivesData = await archivesResponse.json();
        const archiveUrls = archivesData.archives;

        if (!archiveUrls || archiveUrls.length === 0) {
            return;
        }


        const openingStats = {}; 
        let gamesAnalyzed = 0
        let urlNum = 0
        
        while (archiveUrls.at(urlNum) && gamesAnalyzed <= 5000) {
            const url = (archiveUrls.at(urlNum))
            urlNum++;
            const gamesResponse = await fetch(url);
            if (!gamesResponse.ok) {
                continue;
            }
            const gamesData = await gamesResponse.json();
            gamesAnalyzed += gamesData.games.length
            for (let game of gamesData.games) {
                if (((game.white.username.toLowerCase() === targetUsername.toLowerCase() && targetColor === 'WHITE') ||
                    (game.black.username.toLowerCase() === targetUsername.toLowerCase() && targetColor === 'BLACK')) && game.eco) {
                    
                    const eco = game.eco.split("/").at(-1)
                    let result = 'DRAW';

                    if (targetColor === 'WHITE') {
                        result = game.white.result === 'win' ? 'WIN' : game.black.result === 'win' ? 'LOSS' : 'DRAW';
                    } else { 
                        result = game.black.result === 'win' ? 'WIN' : game.white.result === 'win' ? 'LOSS' : 'DRAW';
                    }

                    if (!openingStats[eco]) {
                        openingStats[eco] = { total: 0, wins: 0, losses: 0, draws: 0 };
                    }

                    openingStats[eco].total++;
                    if (result === 'WIN') openingStats[eco].wins++;
                    else if (result === 'LOSS') openingStats[eco].losses++;
                    else openingStats[eco].draws++;
                }
            }

        }
        let finalResults = []
        for (let i in openingStats) {
            if (openingStats[i].total >= MIN_GAMES_THRESHOLD) {
                finalResults.push({
                    eco: i,
                    total: openingStats[i].total,
                    winRate: ((openingStats[i].wins / openingStats[i].total) * 100).toFixed(1)
                });
            }
        }
        return finalResults

    } catch (error) {
        console.error('\nAn error occurred during API processing:', error.message);
    }
}


router.get('/user', async (req, res) => {
    const url = `https://api.chess.com/pub/player/${req.query.username}`;
    const statsUrl = `https://api.chess.com/pub/player/${req.query.username}/stats`;
    try {
        const response = await fetch(url);
        const statsResponse = await fetch(statsUrl);
        if (response.status === 404 || statsResponse.status === 404) {
            const msg = encodeURIComponent('Username not found.');
            return res.redirect(`/error?msg=${msg}&status=404`);
        }
        
        if (!response.ok || !statsResponse.ok) {
            const msg = encodeURIComponent('There was an error.');
            return res.redirect(`/error?msg=${msg}&status=${response.status}`);
        }

        const profileData = await response.json();
        const stats = await statsResponse.json();
        let divider = 0
        let rating = 0
        if (!isNaN(stats.chess_blitz?.last?.rating) ?? false){
            divider++;
            rating += Number(stats.chess_blitz?.last?.rating)
        }
        if (!isNaN(stats.chess_rapid?.last?.rating) ?? false){
            divider++;
            rating += Number(stats.chess_rapid?.last?.rating)
        }
        if (!isNaN(stats.chess_bullet?.last?.rating) ?? false){
            divider++;
            rating += Number(stats.chess_bullet?.last?.rating)
        }
        let avgElo = 'You have never played rated Chess';
        if (rating != 0){
            avgElo = parseInt(rating/divider);
        }
        let gamesTable;
        getRecentGames(req.query.username).then(data => {
            gamesTable= `
            <div class="table-responsive mt-4">
                <table class="table table-dark table-striped table-hover shadow-sm">
                    <thead>
                        <tr>
                            <th>Color</th>
                            <th>Opponent</th>
                            <th>Result</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.games.reduce((a,c) => {
                            const resultClass = c.result === 'win' ? 'text-success' : ['checkmated', 'resigned'].includes(c.result) ? 'text-danger' : 'text-secondary';
                            return a+= `
                                <tr>
                                    <td>${c.whiteName}</td>
                                    <td>${c.blackName}</td>
                                    <td class="fw-bold ${resultClass}">${c.result}</td>
                                    <td>
                                        <a href="${c.gameUrl}" target="_blank" class="btn btn-sm btn-outline-info">
                                            View <i class="bi bi-box-arrow-up-right"></i>
                                        </a>
                                    </td>
                                </tr>`;
                            }, '')
                        }
                    </tbody>
                </table>
            </div>`;

            return res.render('details.ejs', {
                profileURL: data.url,
                pageTitle: `Stats for ${req.query.username}`,
                username: req.query.username,
                data: profileData,
                avgElo: avgElo,
                games: gamesTable
            });
        }).catch(error => {
            const msg = encodeURIComponent(error);
            return res.redirect(`/error?msg=${msg}&status=400`);
            
        })


    } catch (error) {
        const msg = encodeURIComponent('There was an error.');
        return res.redirect(`/error?msg=${msg}&status=400`);
    }
    
});

router.get('/scout', async (req, res) => { 
    let opponentsOpenings, playersOpenings;
    if (req.query.color === 'WHITE'){
        opponentsOpenings = await analyzeOpenings(req.query.opponent, 'BLACK')
        playersOpenings = await analyzeOpenings(req.query.player, 'WHITE')
    } else{
        opponentsOpenings = await analyzeOpenings(req.query.opponent, 'WHITE')
        playersOpenings = await analyzeOpenings(req.query.player, 'BLACK')
    }
    let index=1
    let opponentsMostCommon = [...opponentsOpenings].sort((a, b) => b.total - a.total).slice(0, 5).reduce((a,c) => a += 
                                `<li class="list-group-item d-flex justify-content-between bg-light-success text-light">
                                    <span class="badge bg-danger me-2">${index++}</span>
                                    <div class="text-truncate text-start flex-grow-1">
                                        <span class="fw-bold me-1">${c.eco}:</span> 
                                    </div>
                                    <span class="badge bg-dark border border-light rounded-pill">${c.total} games</span>
                                </li>` ,'');

    index = 1
    let opponentsweakest = [...opponentsOpenings].sort((a, b) => a.winRate - b.winRate).slice(0, 5).reduce((a,c) => a += 
                                `<li class="list-group-item d-flex justify-content-between bg-light-success text-light">
                                    <span class="badge bg-danger me-2">${index++}</span>
                                    <div class="text-truncate text-start flex-grow-1">
                                        <span class="fw-bold me-1">${c.eco}:</span> 
                                    </div>
                                    <span class="badge bg-dark border border-light rounded-pill">${c.winRate}% Wins</span>
                                </li>` ,'');

    let opponentGamesAnalyzed = opponentsOpenings.reduce((a, c) => a += c.total, 0)

    let playerMostCommon = [...playersOpenings].sort((a, b) => b.total - a.total).slice(0, 5).reduce((a,c) => a += 
                                `<li class="list-group-item d-flex justify-content-between bg-light-success text-light">
                                    <span class="badge bg-danger me-2">${index++}</span>
                                    <div class="text-truncate text-start flex-grow-1">
                                        <span class="fw-bold me-1">${c.eco}:</span> 
                                    </div>
                                    <span class="badge bg-dark border border-light rounded-pill">${c.total} games</span>
                                </li>` ,'');
    let playerWeakest = [...playersOpenings].sort((a, b) => a.winRate - b.winRate).slice(0, 5).reduce((a,c) => a += 
                                `<li class="list-group-item d-flex justify-content-between bg-light-success text-light">
                                    <span class="badge bg-danger me-2">${index++}</span>
                                    <div class="text-truncate text-start flex-grow-1">
                                        <span class="fw-bold me-1">${c.eco}:</span> 
                                    </div>
                                    <span class="badge bg-dark border border-light rounded-pill">${c.winRate}% Wins</span>
                                </li>` ,'');
    let playerGamesAnalyzed = playersOpenings.reduce((a, c) => a += c.total, 0)

    res.render('scout.ejs', {
        pageTitle: `Scouting Report ${req.query.player} vs ${req.query.opponent}`,
        targetColor: req.query.color,
        player: {username: req.query.player, mostCommon: playerMostCommon, weakest: playerWeakest, num: playerGamesAnalyzed},
        opponent: {username: req.query.opponent, mostCommon: opponentsMostCommon, weakest: opponentsweakest, num: opponentGamesAnalyzed}
    })

});

module.exports = router