/* Important Setup*/
process.stdin.setEncoding("utf8");
const express = require("express");   /* Accessing express module */
const playerRoutes = require('./player')
const gameRoutes = require('./games')
const path = require("path");
const bodyParser = require("body-parser");


/* start app on port and setup */
const app = express();
app.listen(5000);
app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use(bodyParser.urlencoded({extended:false}))
app.use(express.static(path.join(__dirname, 'public')));

/* COMMAND LINE INTERFACE START */
const prompt = "Stop to shutdown the server: \n";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  const dataInput = process.stdin.read();
  if (dataInput !== null) {
    const command = dataInput.trim().toLowerCase();
    if (command === "stop") {
      process.stdout.write("Shutting down the server\n");
      process.exit(0);
    }
    else {
        process.stdout.write(`Invalid command: ${command}\n`);
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});
/* COMMAND LINE INTERFACE END */


app.get("/", async (req, res) => {
    res.render("index.ejs");
});

app.get('/error', (req, res) => {

    const message = req.query.msg || 'An unknown error occurred.';
    const statusCode = Number(req.query.status) || 500;
    const detail = req.query.detail || 'The application encountered an issue.';

    res.status(statusCode); 

    res.render('error', { 
        pageTitle: 'Application Error',
        message: message,
        detail: detail,
        statusCode: statusCode 
    });
});

app.use('/player', playerRoutes);
app.use('/game', gameRoutes);
