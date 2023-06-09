// Using Express to create API endpoints that will be accessed by the client-side react app
const express = require('express');

const videoIndex = require('./video/videoIndex');
//This is to establish connectinn with database.
const mysql = require("mysql2");
const { Client } = require('ssh2');
const sshClient = new Client();
const fs = require('fs');

// This is to allow cross-origin requests. So that the client-side react app can access the API endpoints
const cors = require('cors');

const cookieParser = require('cookie-parser'); // For cookies to be stored in the browser
const session = require('express-session'); // For sessions to be stored in the server

const nodemailer = require('nodemailer'); // Allows emails to be sent to company email

const app = express();
const port = 3001;

app.use(express.json());

//CORS middleware to allow cross-origin requests
app.use(cors({
  origin: ["http://localhost:3000"], // Allow only the react app (the provided URL) to make requests to the API
  methods: ["GET", "POST"], // Methods we want to allow
  credentials: true, // Allow cookies to be enabled and stored in the browser
}));

app.use(cookieParser());
app.use(express.urlencoded({extended: true})); // To parse URL-encoded form data (ex: from login forms)
app.use(session({
  key: "userId",
  secret: "superSecretPassword", // TODO: store this in a .env file for security purposes
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 1000 * 60 * 60 * 24, // User will stay logged in for 24 hours
  },
}));


// Password encryption
const bcrypt = require('bcrypt');
const saltRounds = 10;

const dbServer = {
    host: 'database-1.cjhdgriivebl.us-west-1.rds.amazonaws.com',
    port: '3306',
    user: 'admin',
    password: 'password1',
    database: 't6db'
}
const tunnelConfig = {
    host: 'ec2-50-18-108-83.us-west-1.compute.amazonaws.com',
    port: '22',
    username: 'ubuntu',
    privateKey: fs.readFileSync("../../../../../credentials/key.pem")
}
const forwardConfig = {
    srcHost: '127.0.0.1',
    srcPort: 3306,
    dstHost: dbServer.host,
    dstPort: dbServer.port
};
let db;
const SSHConnection = new Promise((resolve, reject) => {
    sshClient.on('ready', () => {
        sshClient.forwardOut(
        forwardConfig.srcHost,
        forwardConfig.srcPort,
        forwardConfig.dstHost,
        forwardConfig.dstPort,
        (err, stream) => {
             if (err) reject(err);
             const updatedDbServer = {
                 ...dbServer,
                 stream
            };
            db =  mysql.createConnection(updatedDbServer);
            db.connect((error) => {
            if (error) {
                //reject(error);
                console.log('Error connecting to the MySQL Database', error);
                return;
            }
            //resolve(connection);
            console.log('Connection established successfully');
            });
        });
    }).connect(tunnelConfig);
});

// API endpoint that returns all the users from the database
app.get('/users', (req, res) => {
  const sql = 'SELECT * FROM Users';
  db.query(sql, (error, result) => {
    if(error){
      console.error(error.message);
      return;
    }
    res.send(result);
  });
});


// API endpoint that registers a new user
app.post('/register', (req, res) => {
  const Ufirstname = req.body.Ufirstname;
  const Ulastname = req.body.Ulastname;
  const Uusername = req.body.Uusername;
  const Upassword = req.body.Upassword;
  const Uemail = req.body.Uemail;
  const NativeLanguageID = req.body.NativeLanguageID;
  const LearningLanguageID = req.body.LearningLanguageID;

  // For username verification
  const usernameQuery = 'SELECT * FROM Users WHERE Uusername = ?';
  db.query(usernameQuery, [Uusername], (error, result) => {
    if(error){
      console.error(error.message);
      return;
    }
    if (result.length > 0) { // 1. Check if the username already exists in the database
      // 1a. If it does, send an error message
      res.send({message: "Username already exists"});
    } else {
      const emailQuery = 'SELECT * FROM Users WHERE Uemail = ?';
      db.query(emailQuery, [Uemail], (error, result) => {
        if(error){
          console.error(error.message);
          return;
        }
        if (result.length > 0) { // 1. Check if the email already exists in the database
          // 1a. If it does, send an error message
          res.send({message: `Email "${Uemail}" is already in use.`});
          return;
        } else {
          bcrypt.genSalt(saltRounds, (err, salt) => {
            bcrypt.hash(Upassword, salt, (err, hash) => {
              if (err) {
                console.error(err.message);
                return;
              }
              const sql = 'INSERT INTO Users (Ufirstname, Ulastname, Uusername, Upassword, Uemail, NativeLanguageID, LearningLanguageID) VALUES (?,?,?,?,?,?,?)';
              db.query(sql, 
                [Ufirstname, Ulastname, Uusername, hash, Uemail, NativeLanguageID, LearningLanguageID], 
                (error, result) => {
                if(error){
                  console.error(error.message);
                  return;
                }
                res.send(result);
              });
            });
          });
        };
      });
    };
  });
});

// API endpoint that checks if a user is logged in
app.post("/checkLogin", (req, res) => {
  if (req.session.user) { // There is a user session active
    res.send({loggedIn: true, user: req.session.user});
  } else { // There is no user session active
    res.send({ loggedIn: false });
   }
});

// API endpoint that logs in a user
app.post('/login', (req, res) => {
  const Uusername = req.body.Uusername;
  const Upassword = req.body.Upassword;
  
  const sql = 'SELECT * FROM Users WHERE Uusername = ?';
  db.query(sql, [Uusername], (error, result) => {
    if(error){
      //res.send({message: "Error logging in. No such user found (?)"})
      console.error(error.message);
      return;
    }
    if (result.length > 0) { // User found
      const foundUser = result[0];
      bcrypt.compare(Upassword, foundUser.Upassword, (err, response) => {
        if (err) {
          console.error(err.message);
          return;
        }
        if (response) {
          req.session.user = foundUser;
          //req.app.locals.user = foundUser; // Set the session local to the user that just logged in so login session can persist across pages
          res.send(foundUser);
        } else { // Invalid password (display both for security reasons)
          res.send({message: "Invalid Username/Password."})
        }
      });
    } else { // User not found (display both for security reasons)
      res.send({message: "Invalid Username/Password."})
    }
  });
});

// API endpoint to logout (clears user session and resets the session local (req.app.locals.user)))
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).send('An error occurred');
    } else {
      // Clear session cookie
      res.clearCookie('userId');
      res.send('User logged out successfully');
    }
  });
  //req.app.locals.user = undefined; // Reset the session local to undefined
});

// API endpoint that allows the user to send an email to the company email
app.post('/contactus', (req, res) => {
  const email = req.body.email;
  const message = req.body.message;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ulingual6@gmail.com', //
      pass: 'dgjrzmwcnxdhsigo' //
    }
  });
  const mailOptions = {
    from: 'ulingual6@gmail.com',
    to: 'ulingual6@gmail.com',
    subject: 'New Ticket From: ' + email,
    text: message
  };
  transporter.sendMail(mailOptions, (err) => {
    if(err) {
      console.error(err);
      return;
    } else {
      res.send({message: "Your email has been sent. You may expect a reply within 48 hours."})
    }
  })
});

//API endpoint that returns user's info
app.post("/user/info", (req, res) => {
  const userID = req.session.user.UserID;
  var sql = 'SELECT L.Language FROM languages L, Users U WHERE U.UserID = ? && U.LearningLanguageID = L.LanguageID';
  db.query(sql, [userID], (err, results) => {
    if(err) {
      console.log(err.message);
      return;
    } else {
      req.session.user.LearningLanguage = results[0].Language;
      sql = 'SELECT L.Language FROM languages L, Users U WHERE U.UserID = ? && U.NativeLanguageID = L.LanguageID';
      db.query(sql, [userID], (err, results) => {
        if(err) {
          console.log(err.message);
          return;
        } else {
          req.session.user.NativeLanguage = results[0].Language;
          res.send(req.session.user);
        }
      })
    }
  })
});

//API endpoint that returns user's friend count
app.post('/friends/count', (req, res) => {
  let userID = req.session.user.UserID;
  if(req.query.user) {
    userID = req.query.user;
  }

  const sql = 'SELECT COUNT(*) as count FROM friends WHERE UserID1 = ?';
  db.query(sql, [userID], (err, results) => {
    if(err) {
      console.error(err.message);
      return;
    } else {
    res.send({count: results[0].count});
    }
  });
});

//API endpoint that returns user's friends
app.post('/friends', (req, res) => {
  const userID = req.session.user.UserID;

  const sql = 'SELECT U.UserID, U.Uusername, U.Image FROM Users U, friends F WHERE F.UserID1 = ? && U.UserID = F.UserID2';
  db.query(sql, [userID], (err, results) => {
    if(err) {
      console.error(err.message);
      return;
    } else {
    res.send(results);
    }
  });
});

//API enpoint that updates the user's profile description
//TODO: allow image upload
app.post('/profile', (req, res) => {
  const userID = req.session.user.UserID;
  const Description = req.body.Description;
  const LearningLanguage = req.body.LearningLanguage;
  let sql = 'SELECT LanguageID FROM languages WHERE Language = ?';
  db.query(sql, [LearningLanguage], (err, results) => {
    if(err) {
      console.error(err.message);
      return;
    } else {
      req.session.LearningLanguageID = results[0].LanguageID;
      const LearningLanguageID = results[0].LanguageID;
      sql = 'UPDATE Users SET Description = ?, LearningLanguageID = ? WHERE UserID = ?';
      db.query(sql, [Description, LearningLanguageID, userID], (err, results) => {
        if(err) {
          console.error(err.message);
          return;
        } else {
          req.session.user.Description = Description;
          req.session.user.LearningLanguage = LearningLanguage;
          res.send(req.session.user);
        }
      });
    }
  });
})

// API endpoint that returns friend's information
app.get('/friend/profile', (req, res) => {
  const user = req.query.user;
  let friend;
  let sql = 'SELECT * FROM Users WHERE Users.Uusername = ?';
  db.query(sql, [user], (err, results) => {
    if(err) {
      console.log(err.message);
      return;
    } else {
      friend = results[0];
      console.log(friend);
      console.log(friend.UserID);
      sql = 'SELECT L.Language FROM languages L, Users U WHERE U.UserID = ? && U.LearningLanguageID = L.LanguageID';
      db.query(sql, [friend.UserID], (err, results) => {
        if(err) {
          console.log(err.message);
          return;
        } else {
          console.log(results[0]);
          console.log(results[0].Language);
          friend.LearningLanguage = results[0].Language;
          sql = 'SELECT L.Language FROM languages L, Users U WHERE U.UserID = ? && U.NativeLanguageID = L.LanguageID';
          db.query(sql, [friend.UserID], (err, results) => {
            if(err) {
              console.log(err.message);
              return;
            } else {
              friend.NativeLanguage = results[0].Language;
              res.send(friend);
            }
          })
        }
      })
    }
  })
});

// API endpoint that returns all the tutors from the database
app.get('/tutors', (req, res) => {
  const sql = 'SELECT * FROM Tutors';
  db.query(sql, (error, result) => {
    if(error){
      console.error(error.message);
      return;
    }
    res.send(result);
  });
});

// API endpoint that returns a search result for tutors from the database
app.get('/user/search', (req, res) => {
  const search = req.query.search;
  //const sql = `SELECT * FROM Tutors WHERE TutorFirstName LIKE '%${search}%' OR TutorLastName LIKE '%${search}%'`;
  const sql = (
    `SELECT U.UserID, U.Uusername, L.Language
    FROM Users U, languages L
    WHERE L.LanguageID = U.NativeLanguageID AND U.Uusername LIKE '%${search}%'
    UNION
    SELECT U.UserID, U.Uusername, L.Language
    FROM Users U, languages L
    WHERE L.LanguageID = U.NativeLanguageID AND L.Language = '${search}'`
  );
  db.query(sql, (error, result) => {
    if (error) {
      console.error(error.message);
      return;
    }
    if(result.length === 0) {
      res.send({message: "No results found."})
    } else {
      res.send(result);
    }
  });
});

// A link to the video chat-related API endpoints
app.use(videoIndex);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
