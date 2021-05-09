const express = require('express');
const path = require('path');

const expressSession = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
require('dotenv').config();

const open = require('open');
const bodyParser = require('body-parser');
const cors = require('cors');

const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');

const dbConn = require('./config/db.config');
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
    next();
});

// Authorization middleware. When used, the
// Access Token must exist and be verified against
// the Auth0 JSON Web Key Set
const checkJwt = jwt({
    // Dynamically provide a signing key
    // based on the kid in the header and
    // the signing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://dev-wxuhoh54.us.auth0.com/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer.
    audience: 'http://localhost:3000/api/v1/cities',
    issuer: [`https://dev-wxuhoh54.us.auth0.com/`],
    algorithms: ['RS256'],
});

// Router Mounting
app.use('/', authRouter);

// Routes Definitions
const secured = (req, res, next) => {
    if (req.user) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
};

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.get('/user', secured, (req, res, next) => {
    const { _raw, _json, ...userProfile } = req.user;
    res.render('user', {
        title: 'Profile',
        userProfile: userProfile,
    });
});

// This route is not needed authentication
app.get('/api/public', (req, res) => {
    res.json({
        message: 'Hello from a public endpoint! Authentication is not needed to see this.',
    });
});

// This route is needed authentication
app.get('/api/private', checkJwt, (req, res) => {
    res.json({
        message: 'Hello from a private endpoint! Authentication is needed to see this.',
    });
});

app.post('/api/edit', (req, res) => {
    dbConn.run('DELETE FROM tblCitiesImport WHERE id = ?', [req.body.id], (err, res) => {
        if (err) {
            console.log('error: ', err);
        } else {
            console.log('Record is Deleted ');
        }
    });
    res.json(req.body);
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
