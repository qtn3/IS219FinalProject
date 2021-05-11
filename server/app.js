const express = require('express');
const path = require('path');

const expressSession = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');

const accessTokenSecret = 'youraccesstokensecret';

require('dotenv').config();

const open = require('open');
const bodyParser = require('body-parser');
const cors = require('cors');

const jwt = require('jsonwebtoken');
const request = require('request');
const mysql = require('mysql');
const authRouter = require('./auth');
const citiesRoutes = require('./routes/cities.routes');

// App Variables
const app = express();
const port = process.env.PORT || '3000';

// Session Configuration
const session = {
    secret: process.env.SESSION_SECRET,
    cookie: {},
    resave: false,
    saveUninitialized: false,
};

if (app.get('env') === 'production') {
    // Serve secure cookies, requires HTTPS
    session.cookie.secure = true;
}

function getMySQLConnection() {
    return mysql.createConnection({
        host     : 'localhost',
        user     : 'root',
        password : 'root',
        port     : '32000',
        database : 'citiesData'
    });
}

// Passport Configuration
const strategy = new Auth0Strategy(
    {
        domain: process.env.AUTH0_DOMAIN,
        clientID: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        callbackURL: process.env.AUTH0_CALLBACK_URL,
    },
    (accessToken, refreshToken, extraParams, profile, done) => {
        // Access tokens are used to authorize users to an API
        // accessToken is the token to call the Auth0 API or a secured 3rd-party API
        // extraParams.id_token has the JSON Web Token (JWT)
        // profile has all the information from the user
        return done(null, profile);
    },
);

// App Configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));

app.use(expressSession(session));
app.use(bodyParser.urlencoded({ extended: true }));

passport.use(strategy);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Creating custom middleware with Express
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.isAuthenticated();
    if (req.user) {
        if (typeof (res._headers.authorization) === "undefined") {
            const accessToken = jwt.sign(req.user._json, accessTokenSecret, {expiresIn: '20m'});
            res.setHeader('Authorization', 'Bearer ' + accessToken);
        }
    }else if (!req.user){
        try {
            res.setHeader('Authorization', ' ');
        }catch{}
    }
    next();
});

// Router Mounting
app.use('/', authRouter);
app.use('/api/private', citiesRoutes)

// Routes Definitions
const secured = (req, res, next) => {
    if (req.user) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
};

const authenticateJWT = (req, res, next) => {
    console.log("authenticating");
    if (req.user) {
        const authHeader = res._headers.authorization;
        console.log(authHeader);
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            jwt.verify(token, accessTokenSecret, (err, user) => {
                if (err) {
                    return res.sendStatus(403);
                }
                req.user = user;
                next();
            });
        } else {
            res.sendStatus(401);
        }
    } else {
        console.log("Failed to validate token!");
        req.session.returnTo = req.originalUrl;
        res.redirect("/login");
    }
};

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.get('/user', authenticateJWT, (req, res, next) => {
    const { _raw, _json, ...userProfile } = req.user;
    res.render('user', {
        title: 'Profile',
        userProfile: userProfile,
    });
});

// This route is not needed authentication
app.get('/db', authenticateJWT, (req, res, next) => {
    request("http://localhost:8000/api/v1/cities", (err, response, body) => {
        if (err || response.statusCode !== 200) {
            return res.sendStatus(500);
        }
        res.render('db', { title : 'Main page', citiesjson : JSON.parse(body).data });
        next();
    });
});

app.get('/form', (req, res) => {
    res.render("form", { title: "Search" });
});

app.post('/results', (req, res, next) => {
    const query = req.body.query;
    let result = [];

    var connection = getMySQLConnection();
    connection.connect();

    connection.query(query.toString(), function(err, rows, fields) {
        if (err) {
            res.status(500).json({"status_code": 500,"status_message": "internal server error"});
        } else {
            // Loop check on each row
            for (var i = 0; i < rows.length; i++) {

                // Create an object to save current row's data
                var city = {
                    'id': rows[i].id,
                    'name': rows[i].fldName,
                    'latitude': rows[i].fldLat,
                    'longitude': rows[i].fldLong,
                    'country': rows[i].fldCountry,
                    'abbreviation': rows[i].fldAbbreviation,
                    'capitalstatus': rows[i].fldCapitalStatus,
                    'population': rows[i].fldPopulation,
                };
                // Add object into array
                result.push(city);
            }

            // Render index.pug page using array
            res.render('results', { title: "City Results", "result": result });
        }
    });

    connection.end();

});


// using as middleware
app.use('/api/v1/cities', citiesRoutes);
app.set('port', process.env.PORT || 8000);

app.listen(port, () => {
    console.log(`Listening to requests on http://localhost:${port}`);
});
/*
const app = express();
app.use(cors());
app.use(express.static('docs'));

// create express app

// Setup server port
// const port = process.env.PORT || 5000;

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// define a root route

// Require employee routes
const citiesRoutes = require('./routes/cities.routes');

// using as middleware
app.use('/api/v1/cities', citiesRoutes);

app.set('port', process.env.PORT || 8000);
app.set('ip', process.env.NODEJS_IP || '127.0.0.1');

app.listen(app.get('port'), () => {
    console.log('%s: Node server started on %s ...', Date(Date.now()), app.get('port'));
    open('http://localhost:8000');
});
*/
